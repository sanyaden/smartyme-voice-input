import 'dotenv/config';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RealtimeSession {
  clientWs: WebSocket;
  openaiWs: WebSocket | null;
  sessionId: string;
  userId: string;
  lessonId: string;
  voice: string; // AI voice preference
  messageQueue: any[];
  openaiConnected: boolean;
  // Database tracking
  dbSessionId?: number; // Database chat session ID
  messageOrder: number; // Track message sequence
  startTime: Date; // Session start time
}

const activeSessions = new Map<string, RealtimeSession>();

// Session management utilities
function getActiveSessionForUser(userId: string): RealtimeSession | null {
  for (const session of Array.from(activeSessions.values())) {
    if (session.userId === userId) {
      return session;
    }
  }
  return null;
}

function closeUserExistingSessions(userId: string) {
  for (const [sessionId, session] of Array.from(activeSessions.entries())) {
    if (session.userId === userId) {
      console.log(`🔄 Closing existing session ${sessionId} for user ${userId}`);
      if (session.openaiWs) {
        session.openaiWs.close();
      }
      session.clientWs.close(1000, 'New session started');
      activeSessions.delete(sessionId);
    }
  }
}

export function handleRealtimeWebSocket(ws: WebSocket, request: IncomingMessage) {
  console.log(`🎙️ New Realtime WebSocket connection attempt`);
  console.log(`Headers:`, request.headers);

  // For now, create temporary session info - authentication will happen via first message
  let sessionId = '';
  let userId = '';
  let lessonId = 'general';
  let authenticated = false;

  // Create temporary session (will be updated after authentication)
  const session: RealtimeSession = {
    clientWs: ws,
    openaiWs: null,
    sessionId: '',
    userId: '',
    lessonId: 'general',
    voice: 'alloy', // default voice
    messageQueue: [],
    openaiConnected: false,
    // Database tracking
    messageOrder: 0,
    startTime: new Date()
  };

  // Handle client disconnection
  ws.on('close', () => {
    console.log(`🔌 Client disconnected: ${sessionId}`);
    if (session.openaiWs) {
      session.openaiWs.close();
    }
    // Mark session as completed in database
    markSessionCompleted(session);
    activeSessions.delete(sessionId);
  });

  // Handle client messages
  ws.on('message', async (data) => {
    console.log(`📩 Raw message received: ${data.toString()}`);
    try {
      const message = JSON.parse(data.toString());
      console.log(`📩 Parsed message from client: ${JSON.stringify(message)}`);
      
      // Handle authentication message first
      if (message.type === 'authenticate') {
        const apiKey = message.api_key;
        const authType = message.auth_type || 'app'; // 'app' or 'web'
        
        // Check authentication based on type
        if (authType === 'app' || authType === 'realtime_app') {
          // Flutter app authentication (both legacy and realtime apps)
          if (apiKey !== process.env.FLUTTER_APP_KEY && !apiKey.startsWith('flutter-realtime-')) {
            console.log('❌ Unauthorized Realtime WebSocket connection (app auth failed)');
            ws.close(1008, 'Unauthorized');
            return;
          }
        } else if (authType === 'web') {
          // Web authentication - for now, allow any web user
          // TODO: Add proper session validation when web auth is implemented
          if (!apiKey || apiKey.length < 10) {
            console.log('❌ Unauthorized Realtime WebSocket connection (invalid web token)');
            ws.close(1008, 'Unauthorized');
            return;
          }
        } else {
          console.log('❌ Invalid auth_type for Realtime WebSocket connection');
          ws.close(1008, 'Invalid auth type');
          return;
        }
        
        // Set session info from auth message
        sessionId = message.session_id || 'session_' + Date.now();
        userId = message.user_id || 'user_' + Date.now();
        lessonId = message.lesson_id || 'general';
        const voicePreference = message.voice || 'alloy'; // Voice preference from client
        authenticated = true;
        
        // Validate voice preference
        const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];
        const selectedVoice = validVoices.includes(voicePreference) ? voicePreference : 'alloy';
        
        // Close any existing sessions for this user (limit one voice session per user)
        closeUserExistingSessions(userId);
        
        // Update session
        session.sessionId = sessionId;
        session.userId = userId;
        session.lessonId = lessonId;
        session.voice = selectedVoice;
        
        activeSessions.set(sessionId, session);
        
        console.log(`✅ Authenticated Realtime session (${authType}): ${sessionId}, user: ${userId}, lesson: ${lessonId}, voice: ${selectedVoice}`);
        
        // Create database session for voice conversation
        await createDatabaseSession(session);
        
        // Now connect to OpenAI
        connectToOpenAI(session);
        return;
      }
      
      // For other messages, check if authenticated
      if (!authenticated) {
        ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
        return;
      }
      
      handleClientMessage(session, message);
    } catch (error) {
      console.error('Error parsing client message:', error);
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for session ${sessionId}:`, error);
    if (session.openaiWs) {
      session.openaiWs.close();
    }
    activeSessions.delete(sessionId);
  });
}

async function connectToOpenAI(session: RealtimeSession) {
  try {
    console.log(`🤖 Connecting to OpenAI Realtime API for session ${session.sessionId}`);

    // Connect to OpenAI Realtime API
    const openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      }
    );

    session.openaiWs = openaiWs;

    openaiWs.on('open', () => {
      console.log(`✅ Connected to OpenAI Realtime API for session ${session.sessionId}`);
      session.openaiConnected = true;
      
      // Send initial session configuration
      const sessionConfig = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: getSystemPromptForLesson(session.lessonId),
          voice: session.voice, // Use user's voice preference
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1',
            language: 'en' // English language for transcription
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 800,
          },
          temperature: 0.8,
          max_response_output_tokens: 2000,
        }
      };

      openaiWs.send(JSON.stringify(sessionConfig));

      // Process any queued messages
      console.log(`📦 Processing ${session.messageQueue.length} queued messages for session ${session.sessionId}`);
      const queuedMessages = [...session.messageQueue];
      session.messageQueue = [];
      
      queuedMessages.forEach(message => {
        console.log(`📤 Sending queued ${message.type} to OpenAI for session ${session.sessionId}`);
        openaiWs.send(JSON.stringify(message));
      });

      // Notify client of successful connection
      session.clientWs.send(JSON.stringify({
        type: 'session.created',
        session_id: session.sessionId
      }));
    });

    openaiWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleOpenAIMessage(session, message);
      } catch (error) {
        console.error('Error parsing OpenAI message:', error);
      }
    });

    openaiWs.on('close', (code, reason) => {
      console.log(`🔌 OpenAI WebSocket closed for session ${session.sessionId}: ${code} - ${reason}`);
      session.openaiConnected = false;
      session.clientWs.send(JSON.stringify({
        type: 'connection.closed',
        code,
        reason: reason.toString()
      }));
    });

    openaiWs.on('error', (error) => {
      console.error(`OpenAI WebSocket error for session ${session.sessionId}:`, error);
      session.clientWs.send(JSON.stringify({
        type: 'error',
        error: 'OpenAI connection error'
      }));
    });

  } catch (error) {
    console.error('Failed to connect to OpenAI Realtime API:', error);
    session.clientWs.send(JSON.stringify({
      type: 'error',
      error: 'Failed to connect to OpenAI Realtime API'
    }));
  }
}

function handleClientMessage(session: RealtimeSession, message: any) {
  if (!session.openaiWs) {
    session.clientWs.send(JSON.stringify({
      type: 'error',
      error: 'Not connected to OpenAI'
    }));
    return;
  }

  // If OpenAI WebSocket is not yet connected, queue the message
  if (!session.openaiConnected) {
    console.log(`🗃️ Queuing ${message.type} for session ${session.sessionId} (OpenAI not ready)`);
    session.messageQueue.push(message);
    return;
  }

  // Forward client messages to OpenAI immediately if connected
  switch (message.type) {
    case 'conversation.item.create':
    case 'input_audio_buffer.append':
    case 'input_audio_buffer.commit':
    case 'input_audio_buffer.clear':
    case 'input_audio_buffer.start':
    case 'response.create':
    case 'response.cancel':
      console.log(`📤 Forwarding ${message.type} to OpenAI for session ${session.sessionId}`);
      try {
        session.openaiWs.send(JSON.stringify(message));
      } catch (error) {
        console.error(`❌ Failed to send ${message.type} to OpenAI: ${error.message}`);
        // Re-queue the message if the connection isn't ready
        session.messageQueue.push(message);
        session.openaiConnected = false;
      }
      break;

    case 'session.update':
      // Allow client to update session, but merge with our base config
      const updatedConfig = {
        ...message,
        session: {
          ...message.session,
          instructions: getSystemPromptForLesson(session.lessonId),
          // Ensure certain settings remain fixed
          modalities: ['text', 'audio'],
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1',
            language: 'en' // English language for transcription
          },
        }
      };
      try {
        session.openaiWs.send(JSON.stringify(updatedConfig));
      } catch (error) {
        console.error(`❌ Failed to send session.update to OpenAI: ${error.message}`);
        session.messageQueue.push(updatedConfig);
        session.openaiConnected = false;
      }
      break;

    default:
      console.log(`❓ Unknown message type from client: ${message.type}`);
      // Forward unknown messages as-is
      try {
        session.openaiWs.send(JSON.stringify(message));
      } catch (error) {
        console.error(`❌ Failed to send ${message.type} to OpenAI: ${error.message}`);
        session.messageQueue.push(message);
        session.openaiConnected = false;
      }
  }
}

function handleOpenAIMessage(session: RealtimeSession, message: any) {
  // Handle database storage for specific message types
  switch (message.type) {
    case 'conversation.item.input_audio_transcription.completed':
      // Save user transcript to database
      saveUserTranscript(session, message);
      break;
    
    case 'response.audio_transcript.done':
      // Save AI response transcript to database
      saveAIResponse(session, message);
      break;
  }

  // Forward all OpenAI messages to client
  switch (message.type) {
    case 'session.created':
    case 'session.updated':
    case 'conversation.created':
    case 'conversation.item.created':
    case 'conversation.item.input_audio_transcription.completed':
    case 'conversation.item.input_audio_transcription.failed':
    case 'conversation.item.input_audio_transcription.delta':
    case 'input_audio_buffer.committed':
    case 'input_audio_buffer.cleared':
    case 'input_audio_buffer.speech_started':
    case 'input_audio_buffer.speech_stopped':
    case 'conversation.item.created':
    case 'response.created':
    case 'response.done':
    case 'response.output_item.added':
    case 'response.output_item.done':
    case 'response.content_part.added':
    case 'response.content_part.done':
    case 'response.text.delta':
    case 'response.text.done':
    case 'response.audio_transcript.delta':
    case 'response.audio_transcript.done':
    case 'response.audio.delta':
    case 'response.audio.done':
    case 'rate_limits.updated':
    case 'error':
      console.log(`📥 Forwarding ${message.type} from OpenAI to client for session ${session.sessionId}`);
      session.clientWs.send(JSON.stringify(message));
      break;

    default:
      console.log(`❓ Unknown message type from OpenAI: ${message.type}`);
      // Forward unknown messages as-is
      session.clientWs.send(JSON.stringify(message));
  }
}

function getSystemPromptForLesson(lessonId: string): string {
  const numericLessonId = parseInt(lessonId);
  
  // Boundaries lessons (169-171): Firm, supportive coaching for assertiveness
  if (numericLessonId >= 169 && numericLessonId <= 171) {
    return `You are Mr. Smart, a firm yet supportive communication coach specializing in boundaries and assertiveness. Your personality combines gentle firmness with practical wisdom.

Your coaching style is:
- **Firm but caring**: You help people find their inner strength without being harsh
- **Direct and practical**: You give specific, actionable advice people can use immediately
- **Empowering**: You help users believe in their right to set boundaries
- **Scenario-focused**: You guide them through realistic practice situations

For boundary-setting lessons, you should:
1. Help users practice saying "no" in different scenarios (work, family, friends)
2. Address guilt and people-pleasing tendencies with understanding but firmness
3. Provide specific phrases and techniques for graceful refusals
4. Role-play challenging situations they might face
5. Build their confidence through positive reinforcement

Your tone: Confident, supportive, and slightly more assertive than usual. Think of yourself as a coach who believes strongly in helping people protect their time and energy.

Remember: This is a voice conversation, so speak naturally and pause appropriately for their responses.`;
  }
  
  // Charisma and first impressions lessons (172-175): Confident, charismatic mentor
  if (numericLessonId >= 172 && numericLessonId <= 175) {
    return `You are Mr. Smart, a charismatic communication coach who embodies the very skills you teach. Your personality radiates confidence, warmth, and magnetic presence.

Your coaching style is:
- **Charismatic and engaging**: You demonstrate the very qualities you're teaching
- **Confident and inspiring**: You help people believe they can be memorable and likable
- **Story-driven**: You use compelling anecdotes and examples to illustrate points
- **Energy-boosting**: Your enthusiasm is contagious and motivates people to practice

For charisma and likability lessons, you should:
1. Help users practice making strong first impressions
2. Guide them through techniques for remembering names and creating connections
3. Share insights about body language, storytelling, and authentic charm
4. Practice conversation starters and memorable interactions
5. Build their social confidence through engaging exercises

Your tone: Warm, confident, and inspiring - like someone people naturally want to be around. Show genuine interest in the user and demonstrate the charismatic qualities you're teaching.

Remember: This is a voice conversation, so let your personality shine through your speaking style.`;
  }
  
  // General communication lessons: Friendly, versatile tutor
  return `You are Mr. Smart, a friendly and knowledgeable communication coach. You adapt your teaching style to help users improve their interpersonal skills in a warm, encouraging environment.

Your coaching approach:
- **Friendly and approachable**: You create a comfortable space for practice and learning
- **Adaptable**: You adjust your style based on what the user needs most
- **Encouraging**: You celebrate progress and help users build confidence
- **Practical**: You focus on skills they can use in real-life situations

Engage naturally in voice conversation, ask thoughtful questions, and provide helpful guidance. Keep responses conversational and appropriately paced for natural speaking interaction.

Remember: This is a spoken conversation with a real person who wants to improve their communication skills.`;
}

// Database session management
async function createDatabaseSession(session: RealtimeSession): Promise<void> {
  try {
    // Ensure user exists in database
    let user = await storage.getUserByUserId(session.userId);
    if (!user) {
      user = await storage.createUser({ 
        userId: session.userId,
        email: null // No email for realtime voice sessions
      });
    } else {
      // Update last active time
      user = await storage.updateUserLastActive(session.userId);
    }

    // Create chat session for voice conversation
    const chatSession = await storage.createChatSession({
      sessionId: session.sessionId,
      userId: session.userId,
      scenarioTitle: `Voice Chat - Lesson ${session.lessonId}`,
      scenarioPrompt: getSystemPromptForLesson(session.lessonId),
      messageCount: 0,
      lessonId: parseInt(session.lessonId) || null,
      courseId: null,
      source: 'voice_realtime',
      entryPoint: 'realtime_voice',
      webviewEntryTimestamp: session.startTime,
    });

    // Store database session ID for future message storage
    session.dbSessionId = chatSession.id;
    
    console.log(`💾 Created database session ${chatSession.id} for voice session ${session.sessionId}`);
  } catch (error) {
    console.error(`❌ Failed to create database session for ${session.sessionId}:`, error);
    // Continue without database storage - don't fail the voice session
  }
}

// Database message storage functions
async function saveUserTranscript(session: RealtimeSession, message: any): Promise<void> {
  if (!session.dbSessionId) {
    console.log(`⚠️ No database session ID for ${session.sessionId}, skipping user transcript save`);
    return;
  }

  try {
    // Extract transcript from message
    const transcript = message.transcript || '';
    if (!transcript.trim()) {
      console.log(`📝 Empty user transcript for session ${session.sessionId}, skipping save`);
      return;
    }

    session.messageOrder++;
    
    await storage.createChatMessage({
      chatSessionId: session.dbSessionId,
      role: 'user',
      content: transcript.trim(),
      messageOrder: session.messageOrder
    });

    console.log(`💾 Saved user transcript: "${transcript.trim()}" (session: ${session.sessionId}, order: ${session.messageOrder})`);
  } catch (error) {
    console.error(`❌ Failed to save user transcript for session ${session.sessionId}:`, error);
  }
}

async function saveAIResponse(session: RealtimeSession, message: any): Promise<void> {
  if (!session.dbSessionId) {
    console.log(`⚠️ No database session ID for ${session.sessionId}, skipping AI response save`);
    return;
  }

  try {
    // Extract transcript from message
    const transcript = message.transcript || '';
    if (!transcript.trim()) {
      console.log(`🤖 Empty AI transcript for session ${session.sessionId}, skipping save`);
      return;
    }

    session.messageOrder++;
    
    await storage.createChatMessage({
      chatSessionId: session.dbSessionId,
      role: 'assistant',
      content: transcript.trim(),
      messageOrder: session.messageOrder
    });

    // Update session message count
    await storage.updateChatSessionMessageCount(session.sessionId, session.messageOrder);

    console.log(`💾 Saved AI response: "${transcript.trim()}" (session: ${session.sessionId}, order: ${session.messageOrder})`);
  } catch (error) {
    console.error(`❌ Failed to save AI response for session ${session.sessionId}:`, error);
  }
}

async function markSessionCompleted(session: RealtimeSession): Promise<void> {
  if (!session.dbSessionId || !session.sessionId) {
    return;
  }

  try {
    // Calculate session duration in seconds
    const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
    
    await storage.markSessionCompleted(session.sessionId, duration);
    
    console.log(`💾 Marked voice session ${session.sessionId} as completed (duration: ${duration}s, messages: ${session.messageOrder})`);
  } catch (error) {
    console.error(`❌ Failed to mark session ${session.sessionId} as completed:`, error);
  }
}

export function getActiveSessionCount(): number {
  return activeSessions.size;
}

export function closeAllSessions(): void {
  console.log(`🔌 Closing all ${activeSessions.size} active Realtime sessions`);
  
  for (const [sessionId, session] of Array.from(activeSessions.entries())) {
    try {
      if (session.openaiWs) {
        session.openaiWs.close();
      }
      session.clientWs.close();
    } catch (error: any) {
      console.error(`Error closing session ${sessionId}:`, error.message || error);
    }
  }
  
  activeSessions.clear();
}