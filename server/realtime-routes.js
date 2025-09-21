const express = require('express');
const OpenAI = require('openai');
const axios = require('axios');
const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Premium voice for education

/**
 * Server-Sent Events endpoint for streaming AI responses
 */
router.post('/chat/stream', async (req, res) => {
  const { sessionId, message, userId, isVoiceInput = false } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    // Get conversation history from database
    const conversationHistory = await getConversationHistory(sessionId);
    
    // Build enhanced context for voice conversations
    const systemPrompt = buildVoiceOptimizedPrompt(isVoiceInput);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Create streaming OpenAI completion
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      stream: true,
      max_tokens: 2000,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    let fullResponse = '';
    let tokenBuffer = '';
    let sentenceBuffer = '';

    // Process streaming tokens
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      
      if (delta) {
        fullResponse += delta;
        tokenBuffer += delta;
        sentenceBuffer += delta;

        // Send token immediately for UI update
        res.write(`data: ${JSON.stringify({
          type: 'token',
          content: delta,
          fullResponse: fullResponse,
          timestamp: Date.now()
        })}\\n\\n`);

        // Check if we have a complete sentence for TTS generation
        if (sentenceBuffer.match(/[.!?]+\\s*/) && sentenceBuffer.length > 20) {
          // Send sentence for immediate TTS processing
          res.write(`data: ${JSON.stringify({
            type: 'sentence_complete',
            sentence: sentenceBuffer.trim(),
            fullResponse: fullResponse,
            timestamp: Date.now()
          })}\\n\\n`);
          
          sentenceBuffer = '';
        }

        // Flush token buffer periodically
        if (tokenBuffer.length > 50) {
          res.write(`data: ${JSON.stringify({
            type: 'token_chunk',
            chunk: tokenBuffer,
            fullResponse: fullResponse,
            timestamp: Date.now()
          })}\\n\\n`);
          
          tokenBuffer = '';
        }
      }
    }

    // Send final complete response
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      fullResponse: fullResponse,
      timestamp: Date.now()
    })}\\n\\n`);

    // Save to database
    await saveConversationMessage(sessionId, userId, message, fullResponse, isVoiceInput);
    
    res.write(`data: [DONE]\\n\\n`);
    res.end();

  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message,
      timestamp: Date.now()
    })}\\n\\n`);
    res.end();
  }
});

/**
 * ElevenLabs TTS endpoint with streaming optimization
 */
router.post('/elevenlabs/tts', async (req, res) => {
  const { 
    text, 
    voice_id = DEFAULT_VOICE_ID,
    model_id = 'eleven_turbo_v2_5',
    optimize_streaming_latency = 3,
    output_format = 'mp3_44100_128',
    voice_settings = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.8,
      use_speaker_boost: true
    }
  } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const response = await axios({
      method: 'post',
      url: `${ELEVENLABS_BASE_URL}/text-to-speech/${voice_id}`,
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      data: {
        text: text.trim(),
        model_id: model_id,
        voice_settings: voice_settings,
        optimize_streaming_latency: optimize_streaming_latency,
        output_format: output_format
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': response.data.length,
      'Cache-Control': 'no-cache'
    });

    res.send(response.data);

  } catch (error) {
    console.error('ElevenLabs TTS error:', error.response?.data || error.message);
    
    if (error.response?.status === 429) {
      return res.status(429).json({ 
        error: 'Rate limit reached. Please try again in a moment.' 
      });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        error: 'Invalid ElevenLabs API key' 
      });
    }
    
    res.status(500).json({ 
      error: 'TTS generation failed',
      details: error.message 
    });
  }
});

/**
 * ElevenLabs streaming TTS for real-time synthesis
 */
router.post('/elevenlabs/stream', async (req, res) => {
  const { 
    text, 
    voice_id = DEFAULT_VOICE_ID,
    model_id = 'eleven_turbo_v2', // Faster model for streaming
    optimize_streaming_latency = 4, // Maximum optimization for real-time
    output_format = 'mp3_22050_32' // Lower quality for faster processing
  } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const response = await axios({
      method: 'post',
      url: `${ELEVENLABS_BASE_URL}/text-to-speech/${voice_id}/stream`,
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      data: {
        text: text.trim(),
        model_id: model_id,
        voice_settings: {
          stability: 0.4, // Lower stability for faster generation
          similarity_boost: 0.7,
          style: 0.6,
          use_speaker_boost: false // Disable for speed
        },
        optimize_streaming_latency: optimize_streaming_latency,
        output_format: output_format
      },
      responseType: 'stream',
      timeout: 15000 // Shorter timeout for streaming
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked'
    });

    // Pipe the streaming response directly to client
    response.data.pipe(res);

  } catch (error) {
    console.error('ElevenLabs streaming TTS error:', error.response?.data || error.message);
    
    if (error.response?.status === 429) {
      return res.status(429).json({ 
        error: 'Rate limit reached. Please try again in a moment.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Streaming TTS generation failed',
      details: error.message 
    });
  }
});

/**
 * Voice analysis endpoint for VAD and speech quality metrics
 */
router.post('/voice/analyze', async (req, res) => {
  const { audioData, sessionId } = req.body;
  
  try {
    // Placeholder for voice analysis logic
    // This would integrate with speech analysis services
    
    const analysis = {
      speechDetected: true,
      confidence: 0.85,
      backgroundNoise: 'low',
      speakingRate: 'normal',
      volume: 'adequate',
      timestamp: Date.now()
    };
    
    res.json(analysis);
    
  } catch (error) {
    console.error('Voice analysis error:', error);
    res.status(500).json({ error: 'Voice analysis failed' });
  }
});

// Helper functions

/**
 * Build voice-optimized system prompt
 */
function buildVoiceOptimizedPrompt(isVoiceInput) {
  const basePrompt = `You are an expert AI communication coach specializing in voice conversations. 

Key guidelines for voice responses:
- Keep responses conversational and natural-sounding
- Use shorter sentences (10-20 words) for better speech synthesis
- Include natural pauses with punctuation
- Avoid complex formatting or symbols
- Be encouraging and supportive
- Ask engaging follow-up questions
- Provide actionable communication tips`;

  if (isVoiceInput) {
    return basePrompt + `

Voice-specific instructions:
- The user is speaking to you, so respond as if in a natural conversation
- Match their energy and speaking style
- Use contractions and informal language when appropriate
- Include verbal acknowledgments like "I understand" or "That's a great point"
- Keep technical explanations simple and conversational`;
  }

  return basePrompt;
}

/**
 * Get conversation history from database
 */
async function getConversationHistory(sessionId) {
  // This would connect to your actual database
  // For now, returning empty array - implement based on your DB structure
  return [];
}

/**
 * Save conversation message to database
 */
async function saveConversationMessage(sessionId, userId, userMessage, aiResponse, isVoiceInput) {
  // Implement database save logic here
  console.log(`Saving conversation: ${sessionId} - Voice: ${isVoiceInput}`);
}

module.exports = router;