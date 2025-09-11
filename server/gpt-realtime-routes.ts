import { Router } from 'express';
import { WebSocketServer } from 'ws';
import { gptRealtimeService } from './gpt-realtime-service.js';

const router = Router();

// Create new GPT Realtime session
router.post('/gpt-realtime/create-session', async (req, res) => {
  try {
    const { userId, lessonId, voice, instructions } = req.body;
    
    if (!userId || !lessonId) {
      return res.status(400).json({
        success: false,
        error: 'userId and lessonId are required'
      });
    }

    const sessionId = await gptRealtimeService.createSession({
      userId,
      lessonId,
      voice: voice || 'alloy',
      instructions: instructions || undefined
    });

    res.json({
      success: true,
      sessionId,
      message: 'GPT Realtime session created successfully'
    });
  } catch (error: any) {
    console.error('Error creating GPT Realtime session:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create session'
    });
  }
});

// Connect to GPT Realtime session (WebRTC)
router.post('/gpt-realtime/connect/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Use server's own OpenAI API key for iOS HTTP compatibility
    const serverApiKey = process.env.OPENAI_API_KEY;
    if (!serverApiKey) {
      return res.status(500).json({
        success: false,
        error: 'Server OpenAI API key not configured'
      });
    }

    const session = await gptRealtimeService.connectSession(sessionId, serverApiKey);
    
    if (session) {
      res.json({
        success: true,
        message: 'Connected to GPT Realtime session',
        sessionId
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
  } catch (error: any) {
    console.error('Error connecting to GPT Realtime session:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to connect to session'
    });
  }
});

// Disconnect GPT Realtime session
router.post('/gpt-realtime/disconnect/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    await gptRealtimeService.disconnectSession(sessionId);
    
    res.json({
      success: true,
      message: 'Disconnected from GPT Realtime session'
    });
  } catch (error: any) {
    console.error('Error disconnecting GPT Realtime session:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to disconnect session'
    });
  }
});

// Get session info
router.get('/gpt-realtime/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = gptRealtimeService.getSession(sessionId);
    
    if (session) {
      res.json({
        success: true,
        sessionId,
        connected: true
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send audio to GPT Realtime (HTTP fallback for iOS)
router.post('/gpt-realtime/audio/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { audio, format } = req.body;
    
    if (!audio) {
      return res.status(400).json({
        success: false,
        error: 'Audio data is required'
      });
    }

    // Use server's OpenAI API key for processing
    const serverApiKey = process.env.OPENAI_API_KEY;
    if (!serverApiKey) {
      return res.status(500).json({
        success: false,
        error: 'Server OpenAI API key not configured'
      });
    }

    const result = await gptRealtimeService.processAudioHTTP(sessionId, audio, format || 'base64', serverApiKey);
    
    res.json({
      success: true,
      audioResponse: result.audioResponse,
      textResponse: result.textResponse,
      userTranscription: result.userTranscription, // Add user transcription for display
      message: 'Audio processed successfully'
    });
  } catch (error: any) {
    console.error('Error processing audio:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process audio'
    });
  }
});

// Send text to GPT Realtime (HTTP fallback for iOS)
router.post('/gpt-realtime/text/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const result = await gptRealtimeService.processTextHTTP(sessionId, text);
    
    res.json({
      success: true,
      audioResponse: result.audioResponse,
      textResponse: result.textResponse,
      message: 'Text processed successfully'
    });
  } catch (error: any) {
    console.error('Error processing text:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process text'
    });
  }
});

// Get service statistics
router.get('/gpt-realtime/stats', (req, res) => {
  try {
    const stats = gptRealtimeService.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Setup WebSocket server for fallback connections
export function setupGPTRealtimeWebSocket(server: any, apiKey: string) {
  const wss = new WebSocketServer({
    server,
    path: '/gpt-realtime-ws'
  });

  wss.on('connection', (ws, req) => {
    console.log('🌐 New GPT Realtime WebSocket connection');
    console.log('   URL:', req.url);
    console.log('   Headers Host:', req.headers.host);
    
    // Extract session ID from query parameters
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    
    console.log('   SessionId extracted:', sessionId);
    
    if (!sessionId) {
      console.log('❌ No sessionId provided - closing connection');
      ws.close(1000, 'Session ID required');
      return;
    }

    // Handle WebSocket connection through service
    gptRealtimeService.handleWebSocketConnection(ws, sessionId, apiKey);
  });

  console.log('🌐 GPT Realtime WebSocket server setup on /gpt-realtime-ws');
  return wss;
}

export default router;