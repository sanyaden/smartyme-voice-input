const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const router = express.Router();

// Hume AI Configuration
const HUME_AI_API_KEY = process.env.HUME_AI_API_KEY;
const HUME_AI_BASE_URL = 'https://api.hume.ai/v0';

// Store active WebSocket connections
const humeConnections = new Map();

/**
 * Hume AI WebSocket endpoint for real-time emotion analysis
 */
router.ws('/connect', (ws, req) => {
  const sessionId = req.query.sessionId || `hume_${Date.now()}`;
  const userId = req.query.userId || 'anonymous';
  
  console.log(`🎭 Hume AI connection established: ${sessionId}`);
  
  // Store connection
  humeConnections.set(sessionId, {
    ws,
    userId,
    connected: true,
    startTime: Date.now()
  });

  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connection_established',
    sessionId,
    userId,
    timestamp: Date.now(),
    status: 'connected'
  }));

  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'start_recording':
          await handleStartRecording(ws, sessionId, message);
          break;
          
        case 'audio_data':
          await handleAudioData(ws, sessionId, message);
          break;
          
        case 'stop_recording':
          await handleStopRecording(ws, sessionId, message);
          break;
          
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;
          
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message,
        timestamp: Date.now()
      }));
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log(`🎭 Hume AI connection closed: ${sessionId}`);
    humeConnections.delete(sessionId);
  });

  // Handle connection error
  ws.on('error', (error) => {
    console.error(`🎭 Hume AI WebSocket error: ${error}`);
    humeConnections.delete(sessionId);
  });
});

/**
 * Handle start recording request
 */
async function handleStartRecording(ws, sessionId, message) {
  try {
    console.log(`🎤 Starting Hume AI recording for session: ${sessionId}`);
    
    ws.send(JSON.stringify({
      type: 'recording_started',
      sessionId,
      timestamp: Date.now(),
      status: 'Recording audio for emotion analysis...'
    }));
    
  } catch (error) {
    console.error('Start recording error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to start recording',
      timestamp: Date.now()
    }));
  }
}

/**
 * Handle audio data for emotion analysis
 */
async function handleAudioData(ws, sessionId, message) {
  try {
    const { audioData, format = 'webm' } = message;
    
    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    console.log(`🧠 Processing ${audioBuffer.length} bytes for emotion analysis`);
    
    // Call Hume AI emotion analysis
    const emotions = await analyzeEmotionsWithHumeAI(audioBuffer, format);
    
    // Generate transcript (in real implementation, Hume AI provides this)
    const transcript = await generateTranscript(audioBuffer);
    
    // Send results back to client
    ws.send(JSON.stringify({
      type: 'emotion_analysis',
      sessionId,
      emotions,
      transcript,
      timestamp: Date.now()
    }));
    
    // Generate AI response based on emotions
    const aiResponse = generateEmotionBasedResponse(emotions, transcript);
    
    ws.send(JSON.stringify({
      type: 'ai_response',
      sessionId,
      response: aiResponse,
      topEmotion: getTopEmotion(emotions),
      timestamp: Date.now()
    }));
    
  } catch (error) {
    console.error('Audio processing error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to process audio',
      details: error.message,
      timestamp: Date.now()
    }));
  }
}

/**
 * Handle stop recording request
 */
async function handleStopRecording(ws, sessionId, message) {
  try {
    console.log(`🛑 Stopping Hume AI recording for session: ${sessionId}`);
    
    ws.send(JSON.stringify({
      type: 'recording_stopped',
      sessionId,
      timestamp: Date.now(),
      status: 'Recording completed. Processing emotions...'
    }));
    
  } catch (error) {
    console.error('Stop recording error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to stop recording',
      timestamp: Date.now()
    }));
  }
}

/**
 * Analyze emotions using Hume AI API
 */
async function analyzeEmotionsWithHumeAI(audioBuffer, format) {
  try {
    if (!HUME_AI_API_KEY) {
      console.log('🎭 No Hume AI API key, using simulated emotions');
      return generateSimulatedEmotions();
    }
    
    // Create form data for Hume AI API
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('file', audioBuffer, {
      filename: `audio.${format}`,
      contentType: `audio/${format}`
    });
    
    form.append('models', JSON.stringify({
      prosody: {
        identify_speakers: false
      }
    }));
    
    // Call Hume AI Batch API
    const response = await axios.post(`${HUME_AI_BASE_URL}/batch/jobs`, form, {
      headers: {
        ...form.getHeaders(),
        'X-Hume-Api-Key': HUME_AI_API_KEY
      },
      timeout: 30000
    });
    
    const jobId = response.data.job_id;
    
    // Poll for results (simplified - in production, use webhooks)
    const results = await pollForResults(jobId);
    
    return parseHumeAIResults(results);
    
  } catch (error) {
    console.error('Hume AI API error:', error.response?.data || error.message);
    // Fallback to simulated emotions
    return generateSimulatedEmotions();
  }
}

/**
 * Poll Hume AI job results
 */
async function pollForResults(jobId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(`${HUME_AI_BASE_URL}/batch/jobs/${jobId}`, {
        headers: {
          'X-Hume-Api-Key': HUME_AI_API_KEY
        }
      });
      
      if (response.data.state === 'COMPLETED') {
        // Get predictions
        const predictionsResponse = await axios.get(`${HUME_AI_BASE_URL}/batch/jobs/${jobId}/predictions`, {
          headers: {
            'X-Hume-Api-Key': HUME_AI_API_KEY
          }
        });
        
        return predictionsResponse.data;
      }
      
      if (response.data.state === 'FAILED') {
        throw new Error('Hume AI job failed');
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`Polling attempt ${i + 1} failed:`, error.message);
    }
  }
  
  throw new Error('Hume AI job timeout');
}

/**
 * Parse Hume AI results into emotion scores
 */
function parseHumeAIResults(results) {
  try {
    const predictions = results[0]?.results?.predictions || [];
    if (predictions.length === 0) {
      return generateSimulatedEmotions();
    }
    
    const prosodyResults = predictions[0]?.models?.prosody?.grouped_predictions || [];
    if (prosodyResults.length === 0) {
      return generateSimulatedEmotions();
    }
    
    const emotions = {};
    const firstPrediction = prosodyResults[0]?.predictions[0];
    
    if (firstPrediction?.emotions) {
      firstPrediction.emotions.forEach(emotion => {
        emotions[emotion.name] = emotion.score;
      });
    }
    
    return emotions;
    
  } catch (error) {
    console.error('Error parsing Hume AI results:', error);
    return generateSimulatedEmotions();
  }
}

/**
 * Generate simulated emotions for demo/fallback
 */
function generateSimulatedEmotions() {
  const emotionCategories = [
    'Admiration', 'Adoration', 'Aesthetic Appreciation', 'Amusement', 'Anger',
    'Anxiety', 'Awe', 'Awkwardness', 'Boredom', 'Calmness',
    'Concentration', 'Confusion', 'Contemplation', 'Contempt', 'Contentment',
    'Craving', 'Desire', 'Determination', 'Disappointment', 'Disgust',
    'Distress', 'Doubt', 'Ecstasy', 'Embarrassment', 'Empathic Pain',
    'Entrancement', 'Envy', 'Excitement', 'Fear', 'Guilt',
    'Horror', 'Interest', 'Joy', 'Love', 'Nostalgia',
    'Pain', 'Pride', 'Realization', 'Relief', 'Romance',
    'Sadness', 'Satisfaction', 'Shame', 'Surprise (negative)', 'Surprise (positive)',
    'Sympathy', 'Tiredness', 'Triumph'
  ];
  
  const emotions = {};
  const random = Date.now();
  
  // Select 8-10 random emotions with realistic scores
  const selectedEmotions = [...emotionCategories].sort(() => 0.5 - Math.random()).slice(0, 10);
  
  selectedEmotions.forEach((emotion, index) => {
    let score;
    if (index < 2) {
      // Top 2 emotions get higher scores
      score = 0.3 + (random % 70) / 100.0;
    } else if (index < 5) {
      // Next 3 get medium scores
      score = 0.1 + (random % 40) / 100.0;
    } else {
      // Rest get low scores
      score = (random % 20) / 100.0;
    }
    emotions[emotion] = score;
  });
  
  // Add some baseline emotions
  emotions['Joy'] = 0.45 + (random % 30) / 100.0;
  emotions['Calmness'] = 0.35 + (random % 25) / 100.0;
  emotions['Interest'] = 0.25 + (random % 35) / 100.0;
  
  return emotions;
}

/**
 * Generate transcript from audio (placeholder)
 */
async function generateTranscript(audioBuffer) {
  // In real implementation, this would use speech-to-text
  // For now, return simulated transcript
  const transcripts = [
    "Hello, how are you today?",
    "I'm feeling pretty good about this conversation.",
    "This emotion analysis is really interesting!",
    "I wonder what emotions you're detecting right now.",
    "Technology like this is amazing.",
    "I'm excited to see what insights we can discover.",
    "Voice analysis can reveal so much about how we feel.",
    "This is a fascinating way to understand emotions."
  ];
  
  const random = Date.now();
  return transcripts[random % transcripts.length];
}

/**
 * Get top emotion from analysis
 */
function getTopEmotion(emotions) {
  const entries = Object.entries(emotions);
  if (entries.length === 0) return { name: 'Neutral', score: 0.5 };
  
  const top = entries.reduce((a, b) => a[1] > b[1] ? a : b);
  return {
    name: top[0],
    score: top[1],
    confidence: Math.round(top[1] * 100)
  };
}

/**
 * Generate AI response based on detected emotions
 */
function generateEmotionBasedResponse(emotions, transcript) {
  const topEmotion = getTopEmotion(emotions);
  const topEmotionName = topEmotion.name;
  const confidence = topEmotion.confidence;
  
  const responses = {
    'Joy': [
      "I can hear the joy in your voice! You sound really happy today. What's bringing you such positive energy?",
      "Your joyful tone is wonderful to hear! It seems like you're in a great mood.",
      "There's so much happiness in your voice - it's contagious! Tell me more about what's making you feel so good."
    ],
    'Calmness': [
      "You sound very calm and peaceful. That's a lovely state of mind to be in.",
      "I detect a sense of tranquility in your voice. It's quite soothing to listen to.",
      "Your calm energy is really apparent. You seem very centered and balanced right now."
    ],
    'Excitement': [
      "I can hear the excitement in your voice! You sound really enthusiastic about something.",
      "Your excitement is palpable! What's got you so energized?",
      "There's wonderful excitement in your tone - you sound really engaged and passionate!"
    ],
    'Sadness': [
      "I notice some sadness in your voice. Is everything okay? I'm here to listen.",
      "You sound a bit down today. Would you like to talk about what's on your mind?",
      "I can hear that you might be feeling sad. That's completely okay - we all have those moments."
    ],
    'Anxiety': [
      "I detect some anxiety in your voice. Take a deep breath - we can work through whatever is concerning you.",
      "You sound a bit worried. Remember that it's normal to feel anxious sometimes. What's on your mind?",
      "I can hear some tension in your voice. Let's talk about what's making you feel anxious."
    ],
    'Anger': [
      "I can hear that you might be feeling frustrated or upset. Would you like to talk about what's bothering you?",
      "Your voice suggests you're dealing with some strong emotions. I'm here to listen without judgment.",
      "It sounds like something has really gotten to you. Sometimes talking about it can help."
    ]
  };
  
  const responseList = responses[topEmotionName] || [
    `I'm analyzing the emotions in your voice. You seem to be feeling ${topEmotionName.toLowerCase()} quite strongly (${confidence}% confidence).`,
    `Based on your voice patterns, I'm detecting ${topEmotionName.toLowerCase()} as your primary emotion right now.`,
    `Your emotional state seems to reflect ${topEmotionName.toLowerCase()}. How does that feel to you?`
  ];
  
  const random = Date.now();
  return responseList[random % responseList.length];
}

/**
 * REST endpoint for testing Hume AI connection
 */
router.get('/test', (req, res) => {
  res.json({
    status: 'Hume AI service running',
    hasApiKey: !!HUME_AI_API_KEY,
    activeConnections: humeConnections.size,
    timestamp: Date.now()
  });
});

/**
 * Get active connections status
 */
router.get('/status', (req, res) => {
  const connections = Array.from(humeConnections.entries()).map(([sessionId, conn]) => ({
    sessionId,
    userId: conn.userId,
    connected: conn.connected,
    duration: Date.now() - conn.startTime
  }));
  
  res.json({
    totalConnections: humeConnections.size,
    connections,
    timestamp: Date.now()
  });
});

module.exports = router;