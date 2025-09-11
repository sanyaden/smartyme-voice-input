import { WebSocket } from 'ws';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface RealtimeSessionConfig {
  userId: string;
  lessonId: string;
  voice?: string;
  instructions?: string;
}

interface RealtimeSession {
  sessionId: string;
  userId: string;
  instructions: string;
  voice: string;
  websocket?: WebSocket;
  connected: boolean;
}

export class GPTRealtimeService {
  private sessions = new Map<string, RealtimeSession>();
  private realtimeWebSockets = new Map<string, WebSocket>();

  constructor() {
    console.log('🤖 GPT Realtime Service initialized');
  }

  async createSession(config: RealtimeSessionConfig): Promise<string> {
    const sessionId = `session_${config.userId}_${Date.now()}`;
    
    try {
      const session: RealtimeSession = {
        sessionId,
        userId: config.userId,
        instructions: config.instructions || `
          You are Mr. Smart, a friendly and supportive communication tutor. 
          Help users improve their communication skills through:
          - Active listening and empathetic responses
          - Clear, constructive feedback
          - Practical tips and techniques
          - Role-playing scenarios
          - Confidence building exercises
          
          Keep responses conversational, encouraging, and focused on practical improvement.
          Speak naturally and warmly, as if you're a trusted mentor.
        `,
        voice: config.voice || 'alloy',
        connected: false
      };

      this.sessions.set(sessionId, session);
      
      console.log(`✅ Created GPT Realtime session: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error('❌ Failed to create GPT Realtime session:', error);
      throw error;
    }
  }

  async connectSession(sessionId: string, apiKey: string): Promise<RealtimeSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      return null;
    }

    try {
      // For HTTP compatibility with iOS, we'll just mark as connected
      // The actual WebSocket connection will be handled in processAudioHTTP
      session.connected = true;
      console.log(`🔗 Connected GPT Realtime session (HTTP mode): ${sessionId}`);
      
      return session;
    } catch (error) {
      console.error(`❌ Failed to connect GPT Realtime session ${sessionId}:`, error);
      throw error;
    }
  }

  getSession(sessionId: string): RealtimeSession | undefined {
    return this.sessions.get(sessionId);
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        // Close WebSocket if exists
        const ws = this.realtimeWebSockets.get(sessionId);
        if (ws) {
          ws.close();
          this.realtimeWebSockets.delete(sessionId);
        }
        
        session.connected = false;
        this.sessions.delete(sessionId);
        console.log(`🔌 Disconnected session: ${sessionId}`);
      } catch (error) {
        console.error(`❌ Error disconnecting session ${sessionId}:`, error);
      }
    }
  }

  // WebSocket fallback handler for server-side connections  
  async handleWebSocketConnection(ws: WebSocket, sessionId: string, apiKey: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      ws.close(1000, 'Session not found');
      return;
    }

    try {
      this.realtimeWebSockets.set(sessionId, ws);
      session.websocket = ws;

      // Handle WebSocket messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'audio_input':
              // Process audio input via sequential pipeline
              if (message.audio) {
                const result = await this.processAudioHTTP(sessionId, message.audio, 'base64', apiKey);
                ws.send(JSON.stringify({
                  type: 'audio_response',
                  textResponse: result.textResponse,
                  audioResponse: result.audioResponse
                }));
              }
              break;
            
            case 'text_input':
              // Handle text input via sequential pipeline
              if (message.text) {
                const result = await this.processTextHTTP(sessionId, message.text);
                ws.send(JSON.stringify({
                  type: 'text_response',
                  textResponse: result.textResponse,
                  audioResponse: result.audioResponse
                }));
              }
              break;
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to process message'
          }));
        }
      });

      ws.on('close', () => {
        this.disconnectSession(sessionId);
      });

      console.log(`🌐 WebSocket session connected: ${sessionId}`);
    } catch (error) {
      console.error(`❌ WebSocket connection failed for session ${sessionId}:`, error);
      ws.close(1000, 'Connection failed');
    }
  }

  // Get session statistics
  getStats() {
    return {
      activeSessions: this.sessions.size,
      activeWebSockets: this.realtimeWebSockets.size,
      sessions: Array.from(this.sessions.keys())
    };
  }

  // Process audio via HTTP using sequential pipeline (iOS fallback)
  async processAudioHTTP(sessionId: string, audioBase64: string, format: string = 'base64', apiKey: string) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      console.log(`🎤 Processing audio HTTP for session: ${sessionId}`);
      
      // Decode base64 audio
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      console.log(`📊 Audio buffer size: ${audioBuffer.length} bytes`);
      
      // Step 1: Convert audio to text using Whisper
      console.log(`🚀 Step 1: Converting audio to text...`);
      const transcribedText = await this.audioToText(audioBuffer, apiKey);
      
      if (!transcribedText.trim()) {
        console.log(`⚠️ No text transcribed from audio`);
        return {
          audioResponse: null,
          textResponse: "I couldn't understand what you said. Please try speaking more clearly.",
          userTranscription: ""  // Empty transcription for failed cases
        };
      }
      
      // Step 2: Get GPT response for the transcribed text
      console.log(`💬 Step 2: Getting GPT response for: "${transcribedText}"`);
      const gptResponse = await this.getGPTResponse(transcribedText, sessionId, apiKey);
      
      // Step 3: Convert response text to audio using TTS
      console.log(`🔊 Step 3: Converting response to audio...`);
      const audioResponseBuffer = await this.textToAudio(gptResponse, session.voice, apiKey);
      
      const result = {
        textResponse: gptResponse,
        audioResponse: audioResponseBuffer.toString('base64'),
        userTranscription: transcribedText  // Add user transcription for display
      };
      
      console.log(`✅ Sequential pipeline completed for session: ${sessionId}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Sequential pipeline failed for session ${sessionId}:`, error);
      // Return fallback response on error
      return {
        audioResponse: null,
        textResponse: "I'm having trouble processing your message right now. Please try again.",
        userTranscription: ""  // Empty transcription for error cases
      };
    }
  }

  // Convert audio buffer to text using OpenAI Whisper
  private async audioToText(audioBuffer: Buffer, apiKey: string): Promise<string> {
    let tempFilePath: string | null = null;
    
    try {
      console.log(`📊 Audio buffer size: ${audioBuffer.length} bytes`);
      
      // Create OpenAI client
      const openai = new OpenAI({
        apiKey: apiKey,
      });
      
      console.log('📡 Sending request to OpenAI Whisper API using SDK...');
      
      // Write buffer to temporary file
      const tempDir = os.tmpdir();
      tempFilePath = path.join(tempDir, `whisper_${Date.now()}.wav`);
      await fs.writeFile(tempFilePath, audioBuffer);
      
      console.log(`📁 Created temporary audio file: ${tempFilePath}`);
      
      const transcription = await openai.audio.transcriptions.create({
        file: fsSync.createReadStream(tempFilePath) as any,
        model: 'whisper-1',
        language: 'en', // Force English language detection to prevent Japanese transcription
      });
      
      console.log(`📝 Whisper transcription: "${transcription.text}"`);
      return transcription.text || '';
    } catch (error) {
      console.error('❌ Audio-to-text conversion failed:', error);
      throw error;
    } finally {
      // Clean up temporary file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
          console.log(`🧹 Cleaned up temporary file: ${tempFilePath}`);
        } catch (cleanupError) {
          console.warn(`⚠️ Could not clean up temporary file: ${tempFilePath}`, cleanupError);
        }
      }
    }
  }

  // Get GPT response for transcribed text
  private async getGPTResponse(text: string, sessionId: string, apiKey: string): Promise<string> {
    try {
      const session = this.sessions.get(sessionId);
      const instructions = session?.instructions || 'You are a helpful communication tutor.';
      
      console.log(`📡 Sending GPT request for text: "${text.substring(0, 50)}..."`);
      
      // Create OpenAI client
      const openai = new OpenAI({
        apiKey: apiKey,
      });
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: instructions
          },
          {
            role: 'user', 
            content: text
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      const gptResponse = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
      console.log(`💬 GPT response (${gptResponse.length} chars): "${gptResponse.substring(0, 100)}..."`);
      return gptResponse;
    } catch (error) {
      console.error('❌ GPT response generation failed:', error);
      throw error;
    }
  }

  // Convert text to audio using OpenAI TTS
  private async textToAudio(text: string, voice: string, apiKey: string): Promise<Buffer> {
    try {
      console.log(`🔊 Converting text to speech: "${text.substring(0, 50)}..." with voice: ${voice}`);
      
      // Create OpenAI client
      const openai = new OpenAI({
        apiKey: apiKey,
      });
      
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice as any,
        input: text,
        response_format: 'wav'
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      console.log(`✅ Generated audio: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      console.error('❌ Text-to-audio conversion failed:', error);
      throw error;
    }
  }

  // Process text via HTTP (same pipeline as audio for consistency)
  async processTextHTTP(sessionId: string, text: string) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      console.log(`💬 Processing text HTTP for session: ${sessionId} - "${text}"`);
      
      // Use the server's API key for processing
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      // Step 1: Get GPT response for the text (same as audio pipeline)
      console.log(`💬 Getting GPT response for text: "${text}"`);
      const gptResponse = await this.getGPTResponse(text, sessionId, apiKey);
      
      // Step 2: Convert response text to audio using TTS (same as audio pipeline)
      console.log(`🔊 Converting response to audio...`);
      const audioResponseBuffer = await this.textToAudio(gptResponse, session.voice, apiKey);
      
      const result = {
        textResponse: gptResponse,
        audioResponse: audioResponseBuffer.toString('base64'),
        userTranscription: text  // Include original text as "transcription"
      };
      
      console.log(`✅ Text HTTP pipeline completed for session: ${sessionId}`);
      return result;
    } catch (error) {
      console.error(`❌ Text HTTP processing failed for session ${sessionId}:`, error);
      // Return fallback response on error
      return {
        audioResponse: null,
        textResponse: "I'm having trouble processing your message right now. Please try again.",
        userTranscription: text
      };
    }
  }

  // Clean up all sessions
  async cleanup() {
    console.log('🧹 Cleaning up sessions...');
    
    const disconnectPromises = Array.from(this.sessions.keys()).map(sessionId => 
      this.disconnectSession(sessionId)
    );
    
    await Promise.all(disconnectPromises);
    
    this.sessions.clear();
    this.realtimeWebSockets.clear();
    
    console.log('✅ Service cleanup complete');
  }
}

export const gptRealtimeService = new GPTRealtimeService();