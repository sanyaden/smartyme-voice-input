import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { insertUserSchema, insertChatSessionSchema, insertChatMessageSchema, insertConversationFeedbackSchema } from "@shared/schema";
import OpenAI from "openai";
import { handleRealtimeWebSocket, closeAllSessions } from "./openai-realtime";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveLessonId, detectLessonIdFormat, mapLongIdToShortId } from "./lesson-mapping";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import axios from "axios";
import gptRealtimeRoutes, { setupGPTRealtimeWebSocket } from "./gpt-realtime-routes";
import { gptRealtimeService } from "./gpt-realtime-service";
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load course content with multiple path fallbacks
let courseData: any = null;
const possiblePaths = [
  path.join(__dirname, 'course-content.json'),
  path.join(process.cwd(), 'server', 'course-content.json'),
  path.join(process.cwd(), 'course-content.json'),
  './server/course-content.json',
  './course-content.json'
];

for (const coursePath of possiblePaths) {
  try {
    if (fs.existsSync(coursePath)) {
      console.log(`Loading course content from: ${coursePath}`);
      courseData = JSON.parse(fs.readFileSync(coursePath, 'utf-8'));
      console.log(`Successfully loaded ${courseData?.lessons?.length || 0} lessons`);
      break;
    }
  } catch (error) {
    console.warn(`Failed to load course content from ${coursePath}:`, error instanceof Error ? error.message : String(error));
  }
}

if (!courseData) {
  console.error("CRITICAL: Could not load course content from any path");
  console.error("Attempted paths:", possiblePaths);
  console.error("Current working directory:", process.cwd());
  console.error("__dirname:", __dirname);
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout for all requests
});

// Initialize ElevenLabs client for high-quality TTS
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
});

// Hume AI Configuration
const HUME_AI_API_KEY = process.env.HUME_AI_API_KEY;
const HUME_AI_SECRET_KEY = process.env.HUME_AI_SECRET_KEY;
const HUME_AI_BASE_URL = 'https://api.hume.ai/v0';

// Store active Hume AI WebSocket connections
const humeConnections = new Map<string, {
  ws: WebSocket;
  userId: string;
  connected: boolean;
  startTime: number;
}>();

// Retry logic with exponential backoff
async function callOpenAIWithRetry(messages: any[], maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 2000,
        temperature: 0.7,
      });
      
      return response;
    } catch (error: any) {
      lastError = error;
      console.error(`OpenAI API attempt ${attempt} failed:`, error.message);
      
      // Don't retry on certain errors
      if (error.status === 401 || error.status === 429 || error.status === 400) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Admin authentication middleware
function adminAuth(req: any, res: any, next: any) {
  const { password } = req.body;
  

  
  if (password === process.env.ADMIN_PASSWORD) {
    req.isAdmin = true;
    next();
  } else {
    res.status(401).json({ message: "Invalid password" });
  }
}

// Admin session middleware
function requireAdminSession(req: any, res: any, next: any) {
  const adminPassword = req.headers.authorization?.replace('Bearer ', '');
  
  if (adminPassword === process.env.ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  console.log('🎯 registerRoutes called - setting up all routes');
  
  // Security middleware for Flutter app
  const FLUTTER_APP_KEY = process.env.FLUTTER_APP_KEY || 'flutter-app-secure-key';

  const authenticateFlutterApp = (req: any, res: any, next: any) => {
    console.log('🚀 authenticateFlutterApp middleware called for:', req.method, req.path);
    const apiKey = req.headers['x-api-key'];
    
    // Allow WebView requests (Flutter WebView calls from web interface)
    const isWebViewRequest = req.headers.referer?.includes('source=flutter_app') || 
                             req.body?.webviewParams || 
                             req.query?.source === 'flutter_app' ||
                             req.headers.referer?.includes('192.168.31.113:3000') || // Local dev requests
                             req.body?.entryPoint === 'flutter_webview'; // Check for Flutter WebView entry point
    
    // Always log authentication attempts for debugging
    console.log('🔐 Authentication check for', req.method, req.path, ':', {
      apiKey: apiKey ? 'present' : 'missing',
      referer: req.headers.referer,
      webviewParamsPresent: !!req.body?.webviewParams,
      webviewParams: req.body?.webviewParams,
      entryPoint: req.body?.entryPoint,
      querySource: req.query?.source,
      bodyKeys: Object.keys(req.body || {}),
      isWebViewRequest,
      decision: isWebViewRequest || apiKey === FLUTTER_APP_KEY ? 'ALLOW' : 'DENY'
    });
    
    if (isWebViewRequest || apiKey === FLUTTER_APP_KEY) {
      next();
    } else {
      console.log('❌ Access denied for:', req.method, req.path);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };

  // Test route to verify routes are working
  app.get('/api/test', (req, res) => {
    console.log('🧪 Test route hit!');
    res.json({ message: 'Test route works!' });
  });

  // WebSocket upgrade detection middleware (MUST be before other middleware)
  app.use('/api/hume-ai/connect', (req, res, next) => {
    // Check for WebSocket upgrade headers
    const isWebSocketUpgrade = req.headers.upgrade?.toLowerCase() === 'websocket' ||
                              req.headers.connection?.toLowerCase().includes('upgrade') ||
                              req.headers['sec-websocket-key'];
    
    if (isWebSocketUpgrade) {
      console.log('🎭 WebSocket upgrade request detected for Hume AI');
      console.log('Headers:', {
        upgrade: req.headers.upgrade,
        connection: req.headers.connection,
        'sec-websocket-key': req.headers['sec-websocket-key'],
        'sec-websocket-version': req.headers['sec-websocket-version'],
        protocol: req.httpVersion
      });
      // Skip regular Express middleware for WebSocket upgrades
      return next();
    }
    
    // For non-WebSocket requests, return a helpful message
    res.status(426).json({
      error: 'Upgrade Required',
      message: 'This endpoint requires a WebSocket connection with proper upgrade headers',
      protocol: 'WebSocket',
      expectedHeaders: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Key': '[client-generated-key]',
        'Sec-WebSocket-Version': '13'
      },
      receivedHeaders: {
        upgrade: req.headers.upgrade,
        connection: req.headers.connection,
        'sec-websocket-key': req.headers['sec-websocket-key']
      }
    });
  });

  // Apply security to API endpoints (except admin)
  app.use('/api/users', authenticateFlutterApp);
  // Temporarily disable /api/chat authentication for debugging
  // app.use('/api/chat', authenticateFlutterApp);
  app.use('/api/tts', authenticateFlutterApp);
  
  // GPT Realtime API routes
  app.use('/api', gptRealtimeRoutes);

  // Hume AI API endpoints
  app.get("/api/hume-ai/test", (req, res) => {
    res.json({
      status: 'Hume AI service running',
      hasApiKey: !!HUME_AI_API_KEY,
      activeConnections: humeConnections.size,
      timestamp: Date.now()
    });
  });

  app.get("/api/hume-ai/status", (req, res) => {
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

  // Admin login endpoint
  app.post("/api/admin/login", adminAuth, async (req, res) => {
    res.json({ message: "Login successful", token: process.env.ADMIN_PASSWORD });
  });

  // Admin metrics endpoint
  app.get("/api/admin/metrics", requireAdminSession, async (req, res) => {
    try {
      const metrics = await storage.getAdminMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching admin metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Admin comments endpoint
  app.get("/api/admin/comments", requireAdminSession, async (req, res) => {
    try {
      const comments = await storage.getFeedbackComments();
      res.json(comments);
    } catch (error) {
      console.error("Error fetching feedback comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });
  
  // Get all lessons
  app.get("/api/lessons", async (req, res) => {
    try {
      if (!courseData) {
        return res.status(500).json({ message: "Course content not available" });
      }
      res.json(courseData.lessons);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

  // Get specific lesson by ID (supports both long and short lesson IDs)
  app.get("/api/lessons/:lessonId", async (req, res) => {
    try {
      const rawLessonId = decodeURIComponent(req.params.lessonId);
      if (!courseData) {
        return res.status(500).json({ message: "Course content not available" });
      }
      
      console.log("🔍 Looking up lesson:", rawLessonId);
      
      // Try direct longId match first (new primary method)
      let lesson = courseData.lessons.find((l: any) => l.longId === rawLessonId);
      
      // Fallback to numeric ID for backward compatibility
      if (!lesson && /^\d+$/.test(rawLessonId)) {
        const numericId = parseInt(rawLessonId);
        lesson = courseData.lessons.find((l: any) => l.id === numericId);
        console.log("🔄 Using numeric fallback for lesson ID:", numericId);
      }
      
      if (!lesson) {
        console.log("❌ Lesson not found:", rawLessonId);
        return res.status(404).json({ message: "Lesson not found" });
      }
      
      console.log("✅ Found lesson:", lesson.title);
      
      res.json({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        sections: lesson.pages.map((page: any) => ({
          id: lesson.pages.indexOf(page) + 1,
          title: page.title,
          content: page.content
        })),
        order: lesson.id
      });
    } catch (error) {
      console.error("Error in lesson lookup:", error);
      res.status(500).json({ message: "Failed to fetch lesson" });
    }
  });

  // User authentication/creation (mobile integration)
  app.post("/api/users", async (req, res) => {
    try {
      const { userId, email } = req.body; // email is optional, userId is required from mobile
      
      if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
        return res.status(400).json({ message: "User ID is required from mobile app" });
      }
      
      const trimmedUserId = userId.trim();
      
      // Check if user already exists
      let user = await storage.getUserByUserId(trimmedUserId);
      if (!user) {
        user = await storage.createUser({ 
          userId: trimmedUserId,
          email: email || null // Optional email for legacy support
        });
      } else {
        // Update last active time
        user = await storage.updateUserLastActive(trimmedUserId);
      }
      
      res.json(user);
    } catch (error) {
      console.error("User creation error:", error);
      res.status(500).json({ 
        message: "Failed to create user",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Create chat session with unique session ID
  app.post("/api/chat/sessions", async (req, res) => {
    try {
      const validatedData = insertChatSessionSchema.parse(req.body);
      
      // Generate unique session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const sessionData = {
        ...validatedData,
        sessionId
      };
      
      const session = await storage.createChatSession(sessionData);
      res.json(session);
    } catch (error) {
      res.status(400).json({ message: "Invalid chat session data" });
    }
  });

  // Get session by session ID
  app.get("/api/chat/sessions/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.getChatSessionBySessionId(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  // Send message to AI tutor with analytics tracking
  app.post("/api/chat/message", async (req, res) => {
    try {
      const { message, sessionId, prompt, scenario, userId, entryPoint, webviewParams } = req.body;

      // Authentication temporarily disabled for debugging
      console.log('💬 Chat message received:', {
        userId,
        entryPoint,
        webviewParamsPresent: !!webviewParams,
        referer: req.headers.referer
      });

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      if (!userId) {
        return res.status(400).json({ message: "User ID is required for mobile integration" });
      }

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        console.error("❌ OpenAI API key not found");
        return res.status(503).json({ message: "AI service unavailable - API key not configured" });
      }
      let session;
      
      if (!sessionId) {
        // Auto-create new session if sessionId is not provided
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Use provided userId from mobile app
        const effectiveUserId = userId;
        
        // Resolve lesson ID to numeric format for database storage
        let resolvedLessonId = null;
        if (webviewParams?.lessonId) {
          resolvedLessonId = resolveLessonId(webviewParams.lessonId);
        }
        
        // Handle courseId - for now store as null since we don't have course mapping yet
        let resolvedCourseId = null;
        if (webviewParams?.courseId) {
          // Try to parse as integer first, if it fails keep as null
          const parsed = parseInt(webviewParams.courseId);
          resolvedCourseId = isNaN(parsed) ? null : parsed;
        }

        // Prepare session data with mobile app userId as primary identifier
        const sessionData = {
          sessionId: newSessionId,
          scenarioPrompt: prompt || "You are a helpful communication tutor.",
          scenarioTitle: scenario || "general",
          userId: effectiveUserId, // Primary identifier from mobile app
          messageCount: 0,
          entryPoint: entryPoint || null,
          lessonId: resolvedLessonId,
          courseId: resolvedCourseId,
          source: "webview", // All users come from mobile integration
          webviewEntryTimestamp: new Date(),
          userEmail: null // Legacy field, not used for mobile integration
        };
        
        session = await storage.createChatSession(sessionData);
      } else {
        // Get existing session
        session = await storage.getChatSessionBySessionId(sessionId);
        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }
      }

      // Get existing messages for this session
      const existingMessages = await storage.getChatMessages(session.id);
      const messageOrder = existingMessages.length + 1;

      // Store user message
      await storage.createChatMessage({
        chatSessionId: session.id,
        role: "user",
        content: message,
        messageOrder
      });

      // Build conversation context for AI
      const conversationHistory = existingMessages.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content
      }));

      const messages = [
        {
          role: "system" as const,
          content: session.scenarioPrompt
        },
        ...conversationHistory,
        {
          role: "user" as const,
          content: message
        }
      ];

      const response = await callOpenAIWithRetry(messages);
      let aiResponse = response.choices[0].message.content || "";
      
      // Clean up response
      aiResponse = aiResponse
        .replace(/<attached_contents>[\s\S]*?<\/attached_contents>/gi, '')
        .replace(/The following files were provided:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '')
        .replace(/Viewing:.*?\n/gi, '')
        .trim();

      // Store AI response
      await storage.createChatMessage({
        chatSessionId: session.id,
        role: "assistant",
        content: aiResponse,
        messageOrder: messageOrder + 1
      });

      // Update session message count
      const newMessageCount = messageOrder + 1;
      await storage.updateChatSessionMessageCount(session.sessionId, newMessageCount);

      res.json({
        response: aiResponse,
        sessionId: session.sessionId,
        messageCount: newMessageCount,
        usage: response.usage
      });
    } catch (error: any) {
      console.error("OpenAI API error:", error);
      
      // Enhanced error handling with specific error types
      let errorMessage = "AI service is temporarily unavailable. Please try again.";
      let statusCode = 500;
      
      if (error.status === 401) {
        errorMessage = "AI service authentication failed. Please contact support.";
        statusCode = 502;
      } else if (error.status === 429) {
        errorMessage = "AI service is experiencing high demand. Please try again in a moment.";
        statusCode = 429;
      } else if (error.status === 400) {
        errorMessage = "Invalid request format. Please try rephrasing your message.";
        statusCode = 400;
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = "Cannot connect to AI service. Please check your internet connection and try again.";
        statusCode = 503;
      }
      
      res.status(statusCode).json({ 
        message: errorMessage,
        retryable: statusCode !== 400 && statusCode !== 502,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Mark session as abandoned
  app.post("/api/chat/sessions/:sessionId/abandon", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.markSessionAbandoned(sessionId);
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark session as abandoned" });
    }
  });

  // Mark session as completed
  app.post("/api/chat/sessions/:sessionId/complete", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { duration } = req.body;
      const session = await storage.markSessionCompleted(sessionId, duration || 0);
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark session as completed" });
    }
  });

  // Get messages for a session
  app.get("/api/chat/sessions/:sessionId/messages", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.getChatSessionBySessionId(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      const messages = await storage.getChatMessages(session.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Get user sessions by user ID
  app.get("/api/users/:userId/sessions", async (req, res) => {
    try {
      const { userId } = req.params;
      const sessions = await storage.getUserSessions(userId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user sessions" });
    }
  });

  // Legacy: Get user sessions by email (deprecated)
  app.get("/api/users/:email/sessions-by-email", async (req, res) => {
    try {
      const { email } = req.params;
      const sessions = await storage.getUserSessionsByEmail(email);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user sessions" });
    }
  });

  // Get analytics data
  app.get("/api/analytics", async (req, res) => {
    try {
      const analytics = await storage.getSessionAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Create conversation feedback
  app.post("/api/feedback", async (req, res) => {
    try {
      const feedbackData = {
        sessionId: req.body.sessionId,
        scenarioTitle: req.body.scenarioTitle,
        overallScore: req.body.overallScore,
        futureConversations: req.body.futureConversations,
        comments: req.body.comments
      };
      
      const validatedData = insertConversationFeedbackSchema.parse(feedbackData);
      const feedback = await storage.createConversationFeedback(validatedData);
      res.json(feedback);
    } catch (error) {
      console.error("Feedback creation error:", error);
      res.status(400).json({ 
        message: "Invalid feedback data", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get conversation feedback by session ID
  app.get("/api/feedback/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const feedback = await storage.getConversationFeedback(sessionId);
      if (!feedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      res.json(feedback);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // Export all conversation data as JSON
  app.get("/api/export", async (req, res) => {
    try {
      const [sessions, feedback] = await Promise.all([
        storage.getAllChatSessions(),
        storage.getAllConversationFeedback()
      ]);

      const exportData = {
        sessions,
        feedback,
        exportedAt: new Date(),
        summary: {
          totalSessions: sessions.length,
          totalFeedback: feedback.length,
          abandonedSessions: sessions.filter(s => s.isAbandoned).length,
          completedSessions: sessions.filter(s => s.completedAt).length
        }
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=ai-tutor-analytics.json');
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Entry point analytics endpoint
  app.get("/api/analytics/entry-points", async (req, res) => {
    try {
      const sessions = await storage.getAllChatSessions();
      
      const entryPointStats = sessions.reduce((acc, session) => {
        const entryPoint = session.entryPoint || 'unknown';
        acc[entryPoint] = (acc[entryPoint] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalSessions = sessions.length;
      const entryPointAnalytics = Object.entries(entryPointStats).map(([entryPoint, count]) => ({
        entryPoint,
        count,
        percentage: totalSessions > 0 ? ((count / totalSessions) * 100).toFixed(1) : '0.0'
      }));

      res.json({
        totalSessions,
        entryPointBreakdown: entryPointAnalytics,
        rawStats: entryPointStats
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch entry point analytics" });
    }
  });

  // Admin endpoint to view all stored data
  app.get("/api/admin/data", async (req, res) => {
    try {
      const [users, chatSessions, conversationFeedback, analytics] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllChatSessions(),
        storage.getAllConversationFeedback(),
        storage.getSessionAnalytics()
      ]);

      res.json({
        users,
        chatSessions,
        conversationFeedback,
        analytics,
        summary: {
          totalUsers: users.length,
          totalChatSessions: chatSessions.length,
          totalFeedbackEntries: conversationFeedback.length
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch admin data" });
    }
  });

  // ElevenLabs TTS endpoint for high-quality voice synthesis
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, optimize_streaming_latency, output_format } = req.body;

      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }

      if (!process.env.ELEVENLABS_API_KEY) {
        console.error("❌ ElevenLabs API key not found");
        return res.status(503).json({ message: "TTS service unavailable - API key not configured" });
      }

      console.log("🗣️ Generating ElevenLabs TTS for text:", text.substring(0, 100) + "...");

      try {
        // Generate speech using ElevenLabs with optimization support - George (British Professor voice)
        const audio = await elevenlabs.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
          text: text,
          modelId: optimize_streaming_latency ? "eleven_turbo_v2" : "eleven_multilingual_v2", // Use faster turbo model if requested
          outputFormat: output_format || "mp3_44100_128", // Support custom output format for speed
          voice_settings: {
            stability: optimize_streaming_latency ? 0.4 : 0.5, // Slightly less stable but faster
            similarity_boost: optimize_streaming_latency ? 0.7 : 0.8, // Reduced for speed
            style: 0.2,
            use_speaker_boost: !optimize_streaming_latency // Disable for faster processing
          }
        });

        console.log("✅ ElevenLabs API call successful");

        // Convert the audio stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of audio) {
          chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);

        console.log(`📊 Generated audio buffer: ${audioBuffer.length} bytes`);

        // Set appropriate headers for audio response
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.length.toString(),
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        });

        res.send(audioBuffer);

      } catch (elevenLabsError: any) {
        console.error("❌ ElevenLabs API error:", elevenLabsError);
        if (elevenLabsError.body?.detail) {
          console.error("📊 Quota details:", elevenLabsError.body.detail);
        }
        throw elevenLabsError;
      }

    } catch (error: any) {
      console.error("ElevenLabs TTS error:", error);
      
      let errorMessage = "TTS service is temporarily unavailable. Please try again.";
      let statusCode = 500;
      
      if (error.status === 401) {
        errorMessage = "TTS service authentication failed.";
        statusCode = 502;
      } else if (error.status === 429) {
        errorMessage = "TTS service rate limit exceeded. Please try again later.";
        statusCode = 429;
      }
      
      res.status(statusCode).json({ 
        message: errorMessage,
        error: error.message
      });
    }
  });

  // Real-time streaming chat endpoint with Server-Sent Events
  app.post("/api/chat/stream", async (req, res) => {
    const { sessionId, message, userId, isVoiceInput = false } = req.body;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    try {
      // Get conversation history
      const conversationHistory = await storage.getChatMessages(sessionId);
      
      // Build enhanced context for voice conversations
      const systemPrompt = buildVoiceOptimizedPrompt(isVoiceInput);
      
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
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
      await storage.insertChatMessage({
        sessionId,
        userId,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        isVoiceInput: isVoiceInput
      });

      await storage.insertChatMessage({
        sessionId,
        userId,
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date().toISOString(),
        isVoiceInput: false
      });
      
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

  // Enhanced ElevenLabs TTS with streaming optimization
  app.post("/api/elevenlabs/tts", async (req, res) => {
    const { 
      text, 
      voice_id = 'JBFqnCBsd6RMkjVDRZzb', // George (British Professor)
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
      const audio = await elevenlabs.textToSpeech.convert(voice_id, {
        text: text.trim(),
        modelId: model_id,
        voice_settings: voice_settings,
        outputFormat: output_format
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audio) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache'
      });

      res.send(audioBuffer);

    } catch (error: any) {
      console.error('ElevenLabs TTS error:', error);
      
      if (error.status === 429) {
        return res.status(429).json({ 
          error: 'Rate limit reached. Please try again in a moment.' 
        });
      }
      
      if (error.status === 401) {
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

  // ElevenLabs streaming TTS for real-time synthesis
  app.post("/api/elevenlabs/stream", async (req, res) => {
    const { 
      text, 
      voice_id = 'JBFqnCBsd6RMkjVDRZzb',
      model_id = 'eleven_turbo_v2',
      optimize_streaming_latency = 4,
      output_format = 'mp3_22050_32'
    } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    try {
      const audio = await elevenlabs.textToSpeech.convert(voice_id, {
        text: text.trim(),
        modelId: model_id,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.7,
          style: 0.6,
          use_speaker_boost: false
        },
        outputFormat: output_format
      });

      res.set({
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache'
      });

      // Stream audio directly to client
      for await (const chunk of audio) {
        res.write(chunk);
      }
      res.end();

    } catch (error: any) {
      console.error('ElevenLabs streaming TTS error:', error);
      
      if (error.status === 429) {
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

  // Voice configuration API endpoints
  app.get("/api/voice/available", async (req, res) => {
    // Return available voices
    const availableVoices = [
      { id: 'alloy', name: 'Alloy', description: 'Professional and clear' },
      { id: 'ash', name: 'Ash', description: 'Casual and conversational' },
      { id: 'ballad', name: 'Ballad', description: 'Smooth and expressive' },
      { id: 'coral', name: 'Coral', description: 'Warm and friendly' },
      { id: 'echo', name: 'Echo', description: 'Clear and articulate' },
      { id: 'sage', name: 'Sage', description: 'Wise and calming' },
      { id: 'shimmer', name: 'Shimmer', description: 'Bright and energetic' },
      { id: 'verse', name: 'Verse', description: 'Poetic and flowing' }
    ];
    res.json({ voices: availableVoices });
  });

  app.post("/api/voice/preference", async (req, res) => {
    try {
      const { user_id, voice } = req.body;
      
      if (!user_id) {
        return res.status(400).json({ error: 'user_id is required' });
      }
      
      const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];
      if (!voice || !validVoices.includes(voice)) {
        return res.status(400).json({ 
          error: 'Invalid voice. Must be one of: ' + validVoices.join(', ')
        });
      }
      
      // For now, just return success. In a full implementation, 
      // you would store this preference in the database
      res.json({ 
        message: 'Voice preference updated successfully',
        user_id,
        voice,
        success: true
      });
      
    } catch (error: any) {
      console.error('Voice preference error:', error);
      res.status(500).json({ 
        error: 'Failed to update voice preference',
        details: error.message 
      });
    }
  });

  app.get("/api/voice/preference/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }
      
      // For now, return default voice. In a full implementation,
      // you would fetch from database
      res.json({ 
        user_id: userId,
        voice: 'alloy', // default voice
        success: true
      });
      
    } catch (error: any) {
      console.error('Get voice preference error:', error);
      res.status(500).json({ 
        error: 'Failed to get voice preference',
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);

  // Configure server for WebSocket upgrades (HTTP/1.1 compatibility)
  httpServer.on('upgrade', (request, socket, head) => {
    console.log('🔄 HTTP upgrade request received:', {
      url: request.url,
      method: request.method,
      headers: {
        upgrade: request.headers.upgrade,
        connection: request.headers.connection,
        'sec-websocket-key': request.headers['sec-websocket-key']
      }
    });

    // Handle Hume AI WebSocket upgrades explicitly
    if (request.url?.includes('/api/hume-ai/connect')) {
      console.log('🎭 Handling Hume AI WebSocket upgrade manually');
      // Let the WebSocket server handle this
      return;
    }

    // Handle OpenAI Realtime WebSocket upgrades
    if (request.url?.includes('/api/realtime/connect')) {
      console.log('🎙️ Handling OpenAI Realtime WebSocket upgrade manually');
      return;
    }
  });

  // Create WebSocket server for OpenAI Realtime API
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/api/realtime/connect'
  });

  console.log('🎙️ WebSocket server created for OpenAI Realtime API');

  wss.on('connection', (ws, request) => {
    handleRealtimeWebSocket(ws, request);
  });

  // Create WebSocket server for Hume AI emotion analysis with enhanced options
  const humeWss = new WebSocketServer({ 
    server: httpServer,
    path: '/api/hume-ai/connect',
    handleProtocols: (protocols, request) => {
      console.log('🔄 WebSocket protocols for Hume AI:', protocols);
      return false; // Use default protocol
    },
    verifyClient: (info) => {
      console.log('🔍 WebSocket verification for Hume AI:', {
        origin: info.origin,
        protocol: info.req.httpVersion,
        upgrade: info.req.headers.upgrade,
        connection: info.req.headers.connection,
        secWebSocketKey: info.req.headers['sec-websocket-key'],
        url: info.req.url
      });
      
      // Extra validation for Google Cloud Run
      if (info.req.headers['sec-websocket-key'] && info.req.headers.upgrade?.toLowerCase() === 'websocket') {
        console.log('✅ Valid WebSocket upgrade request for Hume AI');
        return true;
      }
      
      console.log('❌ Invalid WebSocket upgrade request for Hume AI');
      return false;
    }
  });

  console.log('🎭 WebSocket server created for Hume AI emotion analysis with HTTP/2 compatibility');

  humeWss.on('connection', (ws, request) => {
    console.log('🎭 Hume AI WebSocket connection established successfully');
    handleHumeAIWebSocket(ws, request);
  });

  humeWss.on('error', (error) => {
    console.error('🎭 Hume AI WebSocket server error:', error);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, closing WebSocket connections...');
    closeAllSessions();
    wss.close(() => {
      console.log('✅ WebSocket server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, closing WebSocket connections...');
    closeAllSessions();
    wss.close(() => {
      console.log('✅ WebSocket server closed');
      process.exit(0);
    });
  });

  // Flutter bridge endpoint for managing conversation context between text and voice modes
  app.post("/api/flutter/conversation-context", async (req, res) => {
    try {
      const { userId, lessonId, action, sessionId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      switch (action) {
        case 'get_or_create_session':
          // Get existing session or create new one
          let session = null;
          
          if (sessionId) {
            // Try to find existing session
            session = await storage.getChatSessionBySessionId(sessionId);
          }
          
          if (!session) {
            // Create new session for Flutter voice mode
            const newSessionId = `flutter_voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const sessionData = {
              sessionId: newSessionId,
              userId: userId,
              lessonId: lessonId || 'general',
              scenario: 'Voice conversation with tutor',
              entryPoint: 'flutter_voice',
              webviewParams: null
            };
            
            session = await storage.createChatSession(sessionData);
          }
          
          // Get recent messages for context
          const messages = await storage.getChatMessages(session.id);
          
          res.json({
            session: {
              id: session.id,
              sessionId: session.sessionId,
              userId: session.userId,
              lessonId: session.lessonId,
              scenario: session.scenario
            },
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content,
              timestamp: msg.createdAt
            })),
            contextSummary: messages.length > 0 
              ? `Previous conversation with ${messages.length} messages. Last message: "${messages[messages.length - 1]?.content?.substring(0, 100)}..."`
              : 'New conversation starting'
          });
          break;
          
        case 'sync_session':
          // Sync a text session for voice continuation
          if (!sessionId) {
            return res.status(400).json({ message: "Session ID required for sync" });
          }
          
          const existingSession = await storage.getChatSessionBySessionId(sessionId);
          if (!existingSession) {
            return res.status(404).json({ message: "Session not found" });
          }
          
          const sessionMessages = await storage.getChatMessages(existingSession.id);
          
          res.json({
            session: {
              id: existingSession.id,
              sessionId: existingSession.sessionId,
              userId: existingSession.userId,
              lessonId: existingSession.lessonId,
              scenario: existingSession.scenario
            },
            messages: sessionMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
              timestamp: msg.createdAt
            })),
            contextSummary: `Continuing conversation with ${sessionMessages.length} messages`
          });
          break;
          
        default:
          return res.status(400).json({ message: "Invalid action" });
      }
      
    } catch (error) {
      console.error("Flutter conversation context error:", error);
      res.status(500).json({ message: "Failed to manage conversation context" });
    }
  });

  // Setup GPT Realtime WebSocket server
  if (process.env.OPENAI_API_KEY) {
    setupGPTRealtimeWebSocket(httpServer, process.env.OPENAI_API_KEY);
  } else {
    console.warn('⚠️  OPENAI_API_KEY not found - GPT Realtime WebSocket disabled');
  }

  // Cleanup GPT Realtime service on shutdown
  process.on('SIGTERM', async () => {
    console.log('🧹 Cleaning up GPT Realtime sessions...');
    await gptRealtimeService.cleanup();
  });

  process.on('SIGINT', async () => {
    console.log('🧹 Cleaning up GPT Realtime sessions...');
    await gptRealtimeService.cleanup();
  });

  return httpServer;
}

// Handle Hume AI WebSocket connections
function handleHumeAIWebSocket(ws: WebSocket, request: any) {
  const url = new URL(request.url!, `http://${request.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || `hume_${Date.now()}`;
  const userId = url.searchParams.get('userId') || 'anonymous';
  
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
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'start_recording':
          await handleHumeStartRecording(ws, sessionId, message);
          break;
          
        case 'audio_data':
          await handleHumeAudioData(ws, sessionId, message);
          break;
          
        case 'stop_recording':
          await handleHumeStopRecording(ws, sessionId, message);
          break;
          
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;
          
        default:
          console.log(`Unknown Hume AI message type: ${message.type}`);
      }
    } catch (error: any) {
      console.error('Error processing Hume AI message:', error);
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
}

// Handle start recording request for Hume AI
async function handleHumeStartRecording(ws: WebSocket, sessionId: string, message: any) {
  try {
    console.log(`🎤 Starting Hume AI recording for session: ${sessionId}`);
    
    ws.send(JSON.stringify({
      type: 'recording_started',
      sessionId,
      timestamp: Date.now(),
      status: 'Recording audio for emotion analysis...'
    }));
    
  } catch (error: any) {
    console.error('Hume AI start recording error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to start recording',
      timestamp: Date.now()
    }));
  }
}

// Handle audio data for Hume AI emotion analysis
async function handleHumeAudioData(ws: WebSocket, sessionId: string, message: any) {
  try {
    const { audioData, format = 'webm' } = message;
    
    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    console.log(`🧠 Processing ${audioBuffer.length} bytes for emotion analysis`);
    
    // Analyze emotions (with fallback to simulation)
    const emotions = await analyzeEmotionsWithHumeAI(audioBuffer, format);
    
    // Generate transcript (simulated for now)
    const transcript = generateHumeTranscript();
    
    // Send results back to client
    ws.send(JSON.stringify({
      type: 'emotion_analysis',
      sessionId,
      emotions,
      transcript,
      timestamp: Date.now()
    }));
    
    // Generate AI response based on emotions
    const aiResponse = generateHumeEmotionResponse(emotions, transcript);
    
    ws.send(JSON.stringify({
      type: 'ai_response',
      sessionId,
      response: aiResponse,
      topEmotion: getHumeTopEmotion(emotions),
      timestamp: Date.now()
    }));
    
  } catch (error: any) {
    console.error('Hume AI audio processing error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to process audio',
      details: error.message,
      timestamp: Date.now()
    }));
  }
}

// Handle stop recording request for Hume AI
async function handleHumeStopRecording(ws: WebSocket, sessionId: string, message: any) {
  try {
    console.log(`🛑 Stopping Hume AI recording for session: ${sessionId}`);
    
    ws.send(JSON.stringify({
      type: 'recording_stopped',
      sessionId,
      timestamp: Date.now(),
      status: 'Recording completed. Processing emotions...'
    }));
    
  } catch (error: any) {
    console.error('Hume AI stop recording error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to stop recording',
      timestamp: Date.now()
    }));
  }
}

// Analyze emotions using Hume AI API (with simulation fallback)
async function analyzeEmotionsWithHumeAI(audioBuffer: Buffer, format: string) {
  try {
    if (!HUME_AI_API_KEY || !HUME_AI_SECRET_KEY) {
      console.log('🎭 No Hume AI API credentials, using simulated emotions');
      return generateHumeSimulatedEmotions();
    }
    
    console.log('🎭 Calling real Hume AI API for emotion analysis...');
    
    // Create form data for Hume AI API
    const FormData = require('form-data');
    const form = new FormData();
    
    // Add audio file
    form.append('file', audioBuffer, {
      filename: `audio.${format}`,
      contentType: getContentType(format)
    });
    
    // Add models configuration
    form.append('models', JSON.stringify({
      prosody: {
        identify_speakers: false,
        granularity: "utterance"
      }
    }));
    
    // Call Hume AI Batch API
    console.log('📤 Submitting job to Hume AI...');
    const jobResponse = await axios.post(`${HUME_AI_BASE_URL}/batch/jobs`, form, {
      headers: {
        ...form.getHeaders(),
        'X-Hume-Api-Key': HUME_AI_API_KEY
      },
      timeout: 30000
    });
    
    const jobId = jobResponse.data.job_id;
    console.log(`🔄 Hume AI job created: ${jobId}`);
    
    // Poll for results
    const results = await pollForHumeResults(jobId);
    
    // Parse and return emotions
    const emotions = parseHumeAIResults(results);
    console.log(`✅ Hume AI analysis complete: ${Object.keys(emotions).length} emotions detected`);
    
    return emotions;
    
  } catch (error: any) {
    console.error('Hume AI API error:', error.response?.data || error.message);
    console.log('🎭 Falling back to simulated emotions');
    // Fallback to simulated emotions
    return generateHumeSimulatedEmotions();
  }
}

// Get content type for audio format
function getContentType(format: string): string {
  const contentTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'webm': 'audio/webm',
    'ogg': 'audio/ogg'
  };
  return contentTypes[format] || 'audio/mpeg';
}

// Poll Hume AI job results
async function pollForHumeResults(jobId: string, maxAttempts = 30): Promise<any> {
  console.log(`🔄 Polling for Hume AI job results: ${jobId}`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(`${HUME_AI_BASE_URL}/batch/jobs/${jobId}`, {
        headers: {
          'X-Hume-Api-Key': HUME_AI_API_KEY
        },
        timeout: 10000
      });
      
      const state = response.data.state;
      console.log(`🔄 Job ${jobId} state: ${state} (attempt ${i + 1}/${maxAttempts})`);
      
      if (state === 'COMPLETED') {
        console.log(`✅ Job ${jobId} completed, fetching predictions...`);
        
        // Get predictions
        const predictionsResponse = await axios.get(`${HUME_AI_BASE_URL}/batch/jobs/${jobId}/predictions`, {
          headers: {
            'X-Hume-Api-Key': HUME_AI_API_KEY
          },
          timeout: 10000
        });
        
        return predictionsResponse.data;
      }
      
      if (state === 'FAILED') {
        throw new Error(`Hume AI job ${jobId} failed`);
      }
      
      // Wait before next poll (start with 2s, increase gradually)
      const delay = Math.min(2000 + (i * 1000), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
    } catch (error: any) {
      console.error(`Polling attempt ${i + 1} failed:`, error.message);
      
      if (i === maxAttempts - 1) {
        throw new Error(`Hume AI job polling timeout after ${maxAttempts} attempts`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error(`Hume AI job ${jobId} timeout after ${maxAttempts} attempts`);
}

// Parse Hume AI results into emotion scores
function parseHumeAIResults(results: any): Record<string, number> {
  try {
    console.log('🔍 Parsing Hume AI results...');
    
    if (!results || !Array.isArray(results) || results.length === 0) {
      console.log('⚠️ No results in response, using simulated emotions');
      return generateHumeSimulatedEmotions();
    }
    
    const firstResult = results[0];
    const predictions = firstResult?.results?.predictions || [];
    
    if (predictions.length === 0) {
      console.log('⚠️ No predictions in results, using simulated emotions');
      return generateHumeSimulatedEmotions();
    }
    
    const prosodyResults = predictions[0]?.models?.prosody?.grouped_predictions || [];
    
    if (prosodyResults.length === 0) {
      console.log('⚠️ No prosody results, using simulated emotions');
      return generateHumeSimulatedEmotions();
    }
    
    const emotions: Record<string, number> = {};
    const firstPrediction = prosodyResults[0]?.predictions?.[0];
    
    if (firstPrediction?.emotions && Array.isArray(firstPrediction.emotions)) {
      firstPrediction.emotions.forEach((emotion: any) => {
        if (emotion.name && typeof emotion.score === 'number') {
          emotions[emotion.name] = emotion.score;
        }
      });
      
      console.log(`✅ Parsed ${Object.keys(emotions).length} emotions from Hume AI`);
      return emotions;
    }
    
    console.log('⚠️ No valid emotions in prediction, using simulated emotions');
    return generateHumeSimulatedEmotions();
    
  } catch (error: any) {
    console.error('Error parsing Hume AI results:', error);
    console.log('🎭 Falling back to simulated emotions');
    return generateHumeSimulatedEmotions();
  }
}

// Generate simulated emotions for Hume AI demo
function generateHumeSimulatedEmotions() {
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
  
  const emotions: Record<string, number> = {};
  const random = Date.now();
  
  // Select 8-10 random emotions with realistic scores
  const selectedEmotions = [...emotionCategories].sort(() => 0.5 - Math.random()).slice(0, 10);
  
  selectedEmotions.forEach((emotion, index) => {
    let score: number;
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

// Generate transcript for Hume AI
function generateHumeTranscript(): string {
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

// Get top emotion from Hume AI analysis
function getHumeTopEmotion(emotions: Record<string, number>) {
  const entries = Object.entries(emotions);
  if (entries.length === 0) return { name: 'Neutral', score: 0.5, confidence: 50 };
  
  const top = entries.reduce((a, b) => a[1] > b[1] ? a : b);
  return {
    name: top[0],
    score: top[1],
    confidence: Math.round(top[1] * 100)
  };
}

// Generate AI response based on Hume AI detected emotions
function generateHumeEmotionResponse(emotions: Record<string, number>, transcript: string): string {
  const topEmotion = getHumeTopEmotion(emotions);
  const topEmotionName = topEmotion.name;
  const confidence = topEmotion.confidence;
  
  const responses: Record<string, string[]> = {
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

// Helper function to build voice-optimized system prompt
function buildVoiceOptimizedPrompt(isVoiceInput: boolean): string {
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
