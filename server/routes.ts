import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertChatSessionSchema, insertChatMessageSchema, insertConversationFeedbackSchema } from "@shared/schema";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveLessonId, detectLessonIdFormat, mapLongIdToShortId } from "./lesson-mapping";

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

  const httpServer = createServer(app);
  return httpServer;
}
