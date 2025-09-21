export interface VoiceClientConfig {
  userId?: string;
  lessonId?: string;
  voice?: string;
  onConnectionChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  onVoiceStatusChange?: (status: 'idle' | 'listening' | 'processing' | 'speaking') => void;
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  onAudioReceived?: (audioData: ArrayBuffer) => void;
}

export class VoiceClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioQueue: Float32Array[] = [];
  private config: VoiceClientConfig;

  constructor(config: VoiceClientConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Check if we're in a WebView environment
      const isWebView = /webview|wv/i.test(navigator.userAgent) || 
                        window.location.search.includes('source=flutter_app') ||
                        !navigator.mediaDevices;

      if (isWebView || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.config.onError?.('WebView environment detected. Voice input requires native app microphone access. Please use the native voice interface instead.');
        throw new Error('Microphone not available in WebView');
      }

      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });

      // Request microphone permission
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      console.log('🎙️ Audio context initialized');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      this.config.onError?.('Microphone access denied. Please allow microphone permissions.');
      throw error;
    }
  }

  async connect(): Promise<void> {
    if (!this.audioContext || !this.stream) {
      throw new Error('Audio not initialized. Call initialize() first.');
    }

    this.config.onConnectionChange?.('connecting');

    try {
      // Connect to WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:${window.location.port}/api/realtime/connect`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🎙️ Connected to voice service');
        
        // Send authentication message
        const authMessage = {
          type: 'authenticate',
          auth_type: 'web',
          api_key: `web-session-${Date.now()}`, // Simple web token for now
          session_id: `voice_${Date.now()}`,
          user_id: this.config.userId || `user_${Date.now()}`,
          lesson_id: this.config.lessonId || 'general',
          voice: this.config.voice || 'alloy'
        };

        this.ws?.send(JSON.stringify(authMessage));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing voice message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 Voice service disconnected');
        this.config.onConnectionChange?.('disconnected');
        this.config.onVoiceStatusChange?.('idle');
        this.stopRecording();
      };

      this.ws.onerror = (error) => {
        console.error('Voice service error:', error);
        this.config.onConnectionChange?.('error');
        this.config.onError?.('Failed to connect to voice service');
      };

    } catch (error) {
      console.error('Failed to connect to voice service:', error);
      this.config.onConnectionChange?.('error');
      this.config.onError?.('Connection failed');
      throw error;
    }
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'session.created':
        this.config.onConnectionChange?.('connected');
        this.startRecording();
        break;
      
      case 'response.audio_transcript.delta':
        if (message.delta) {
          this.config.onTranscript?.(message.delta);
        }
        break;
      
      case 'response.audio.delta':
        // Handle audio playback
        if (message.delta) {
          this.playAudioChunk(message.delta);
        }
        break;
      
      case 'input_audio_buffer.speech_started':
        this.config.onVoiceStatusChange?.('listening');
        break;
      
      case 'input_audio_buffer.speech_stopped':
        this.config.onVoiceStatusChange?.('processing');
        break;
      
      case 'response.audio.done':
        this.config.onVoiceStatusChange?.('idle');
        break;
      
      case 'response.audio_transcript.done':
        // Full transcript received
        if (message.transcript) {
          this.config.onTranscript?.(message.transcript);
        }
        break;
      
      case 'error':
        this.config.onError?.(message.error);
        this.config.onConnectionChange?.('error');
        break;
      
      default:
        console.log('Unhandled voice message:', message);
    }
  }

  private async startRecording(): Promise<void> {
    if (!this.audioContext || !this.stream || this.isRecording) return;

    try {
      this.isRecording = true;
      this.config.onVoiceStatusChange?.('listening');

      // Create audio source and processor
      const source = this.audioContext.createMediaStreamSource(this.stream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        if (!this.isRecording) return;

        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM16 format
        const pcm16 = this.floatTo16BitPCM(inputData);
        
        // Convert to base64 and send to server
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Audio
          }));
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      console.log('🎙️ Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.config.onError?.('Failed to start recording');
      this.isRecording = false;
    }
  }

  private stopRecording(): void {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    console.log('🎙️ Recording stopped');
  }

  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    
    return new Int16Array(buffer);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private playAudioChunk(audioData: string): void {
    if (!this.audioContext) return;

    try {
      // Decode base64 audio data
      const binaryString = window.atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 to Float32Array for playback
      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 0x7FFF;
      }

      // Create audio buffer and play
      const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 24000);
      audioBuffer.getChannelData(0).set(floatData);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();

      this.config.onVoiceStatusChange?.('speaking');
      
      // Notify when audio finishes playing
      source.onended = () => {
        this.config.onVoiceStatusChange?.('idle');
      };

    } catch (error) {
      console.error('Error playing audio chunk:', error);
    }
  }

  disconnect(): void {
    this.stopRecording();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.config.onConnectionChange?.('disconnected');
    this.config.onVoiceStatusChange?.('idle');
  }

  // Public method to send a text message (for testing)
  sendTextMessage(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: text
            }
          ]
        }
      }));

      // Trigger response
      this.ws.send(JSON.stringify({
        type: 'response.create'
      }));
    }
  }

  // Update voice preference
  updateVoice(voice: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          voice: voice
        }
      }));
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}