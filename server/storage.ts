import { users, chatSessions, chatMessages, conversationFeedback, type User, type InsertUser, type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage, type ConversationFeedback, type InsertConversationFeedback } from "@shared/schema";
import { db } from "./db";
import { eq, and, isNotNull } from "drizzle-orm";
import { LESSON_MAPPINGS } from "./lesson-mapping";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUserId(userId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastActive(userId: string): Promise<User>;
  // Legacy support - will be deprecated
  getUserByEmail(email: string): Promise<User | undefined>;
  
  // Chat session management
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: number): Promise<ChatSession | undefined>;
  getChatSessionBySessionId(sessionId: string): Promise<ChatSession | undefined>;
  updateChatSessionMessageCount(sessionId: string, messageCount: number): Promise<ChatSession>;
  markSessionAbandoned(sessionId: string): Promise<ChatSession>;
  markSessionCompleted(sessionId: string, duration: number): Promise<ChatSession>;
  
  // Chat message management
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(chatSessionId: number): Promise<ChatMessage[]>;
  
  // Conversation feedback methods
  createConversationFeedback(feedback: InsertConversationFeedback): Promise<ConversationFeedback>;
  getConversationFeedback(sessionId: string): Promise<ConversationFeedback | undefined>;
  
  // Analytics methods
  getAllUsers(): Promise<User[]>;
  getAllChatSessions(): Promise<ChatSession[]>;
  getAllConversationFeedback(): Promise<ConversationFeedback[]>;
  getUserSessions(userId: string): Promise<ChatSession[]>;
  // Legacy support - will be deprecated
  getUserSessionsByEmail(email: string): Promise<ChatSession[]>;
  getSessionAnalytics(): Promise<{
    totalSessions: number;
    abandonedSessions: number;
    completedSessions: number;
    averageMessageCount: number;
    averageDuration: number;
  }>;
  
  // Admin analytics methods
  getAdminMetrics(): Promise<{
    users: { total: number };
    sessions: { 
      total: number;
      perUser: number;
      byScenario: { [scenario: string]: number };
      byEntryPoint: { main_screen: number; lesson_end: number; other: number };
      byLesson: { [lessonId: string]: { count: number; title: string; scenarios: { [scenario: string]: number } } };
    };
    messages: {
      averagePerSession: number;
      averageByScenario: { [scenario: string]: number };
    };
    satisfaction: {
      overall: { average: number; distribution: { [key: number]: number } };
      byScenario: { [scenario: string]: { average: number; distribution: { [key: number]: number } } };
    };
    futureConversations: {
      overall: { yes: number; maybe: number; no: number };
      byScenario: { [scenario: string]: { yes: number; maybe: number; no: number } };
    };
  }>;
  
  // Get feedback comments with scenario and date
  getFeedbackComments(): Promise<{
    scenario: string;
    date: Date;
    comment: string;
  }[]>;
}

// Temporary in-memory storage for development
class MemoryStorage implements IStorage {
  private users: User[] = [];
  private sessions: ChatSession[] = [];
  private messages: ChatMessage[] = [];
  private feedback: ConversationFeedback[] = [];
  private nextUserId = 1;
  private nextSessionId = 1;
  private nextMessageId = 1;
  private nextFeedbackId = 1;

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByUserId(userId: string): Promise<User | undefined> {
    return this.users.find(u => u.userId === userId);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(u => u.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: this.nextUserId++,
      userId: user.userId,
      email: user.email || null,
      createdAt: new Date(),
      lastActiveAt: new Date()
    };
    this.users.push(newUser);
    return newUser;
  }

  async updateUserLastActive(userId: string): Promise<User> {
    const user = this.users.find(u => u.userId === userId);
    if (!user) throw new Error("User not found");
    user.lastActiveAt = new Date();
    return user;
  }

  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    const newSession: ChatSession = {
      id: this.nextSessionId++,
      sessionId: session.sessionId,
      scenarioPrompt: session.scenarioPrompt,
      scenarioTitle: session.scenarioTitle,
      userId: session.userId,
      messageCount: 0,
      createdAt: new Date(),
      isAbandoned: false,
      abandonedAt: null,
      completedAt: null,
      duration: null,
      entryPoint: session.entryPoint || null,
      lessonId: session.lessonId || null,
      courseId: session.courseId || null,
      source: session.source || "webview",
      webviewEntryTimestamp: session.webviewEntryTimestamp || null,
      userEmail: session.userEmail || null // Legacy support
    };
    this.sessions.push(newSession);
    return newSession;
  }

  async getChatSession(id: number): Promise<ChatSession | undefined> {
    return this.sessions.find(s => s.id === id);
  }

  async getChatSessionBySessionId(sessionId: string): Promise<ChatSession | undefined> {
    return this.sessions.find(s => s.sessionId === sessionId);
  }

  async updateChatSessionMessageCount(sessionId: string, messageCount: number): Promise<ChatSession> {
    const session = this.sessions.find(s => s.sessionId === sessionId);
    if (!session) throw new Error("Session not found");
    session.messageCount = messageCount;
    return session;
  }

  async markSessionAbandoned(sessionId: string): Promise<ChatSession> {
    const session = this.sessions.find(s => s.sessionId === sessionId);
    if (!session) throw new Error("Session not found");
    session.isAbandoned = true;
    return session;
  }

  async markSessionCompleted(sessionId: string, duration: number): Promise<ChatSession> {
    const session = this.sessions.find(s => s.sessionId === sessionId);
    if (!session) throw new Error("Session not found");
    session.completedAt = new Date();
    session.duration = duration;
    return session;
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      id: this.nextMessageId++,
      chatSessionId: message.chatSessionId,
      role: message.role,
      content: message.content,
      messageOrder: message.messageOrder,
      createdAt: new Date()
    };
    this.messages.push(newMessage);
    return newMessage;
  }

  async getChatMessages(chatSessionId: number): Promise<ChatMessage[]> {
    return this.messages
      .filter(m => m.chatSessionId === chatSessionId)
      .sort((a, b) => a.messageOrder - b.messageOrder);
  }

  async createConversationFeedback(feedback: InsertConversationFeedback): Promise<ConversationFeedback> {
    const newFeedback: ConversationFeedback = {
      id: this.nextFeedbackId++,
      sessionId: feedback.sessionId,
      scenarioTitle: feedback.scenarioTitle || null,
      overallScore: feedback.overallScore || null,
      futureConversations: feedback.futureConversations || null,
      comments: feedback.comments || null,
      createdAt: new Date()
    };
    this.feedback.push(newFeedback);
    return newFeedback;
  }

  async getConversationFeedback(sessionId: string): Promise<ConversationFeedback | undefined> {
    return this.feedback.find(f => f.sessionId === sessionId);
  }

  async getAllUsers(): Promise<User[]> {
    return this.users;
  }

  async getAllChatSessions(): Promise<ChatSession[]> {
    return this.sessions;
  }

  async getAllConversationFeedback(): Promise<ConversationFeedback[]> {
    return this.feedback;
  }

  async getUserSessions(userId: string): Promise<ChatSession[]> {
    return this.sessions.filter(s => s.userId === userId);
  }

  async getUserSessionsByEmail(email: string): Promise<ChatSession[]> {
    return this.sessions.filter(s => s.userEmail === email);
  }

  async getSessionAnalytics(): Promise<{
    totalSessions: number;
    abandonedSessions: number;
    completedSessions: number;
    averageMessageCount: number;
    averageDuration: number;
  }> {
    const totalSessions = this.sessions.length;
    const abandonedSessions = this.sessions.filter(s => s.isAbandoned).length;
    const completedSessions = this.sessions.filter(s => s.completedAt).length;
    const averageMessageCount = totalSessions > 0 
      ? this.sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0) / totalSessions 
      : 0;
    const completedWithDuration = this.sessions.filter(s => s.duration);
    const averageDuration = completedWithDuration.length > 0
      ? completedWithDuration.reduce((sum, s) => sum + (s.duration || 0), 0) / completedWithDuration.length
      : 0;

    return {
      totalSessions,
      abandonedSessions,
      completedSessions,
      averageMessageCount,
      averageDuration
    };
  }

  async getAdminMetrics(): Promise<any> {
    // Filter to only include legitimate scenarios
    const validScenarios = [
      'Role play a situation',
      'Clarity rewriter', 
      'Quick quiz on this lesson',
      'Take the diagnostic quiz'
    ];
    
    const sessions = this.sessions.filter(session => 
      validScenarios.includes(session.scenarioTitle)
    );

    // Count unique user IDs from actual chat sessions, not registered users
    const uniqueUserIds = new Set(sessions.map(session => session.userId).filter(id => id));
    const totalUsers = uniqueUserIds.size;
    const totalSessions = sessions.length;
    const perUser = totalUsers > 0 ? totalSessions / totalUsers : 0;

    // Sessions by scenario (only valid scenarios)
    const byScenario: { [scenario: string]: number } = {};
    sessions.forEach(session => {
      byScenario[session.scenarioTitle] = (byScenario[session.scenarioTitle] || 0) + 1;
    });

    // Sessions by entry point (using filtered sessions)
    const byEntryPoint = { main_screen: 0, lesson_end: 0, other: 0 };
    sessions.forEach(session => {
      if (session.entryPoint === 'main_screen') byEntryPoint.main_screen++;
      else if (session.entryPoint === 'lesson_end') byEntryPoint.lesson_end++;
      else byEntryPoint.other++;
    });

    // Average messages per session (using filtered sessions)
    const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);
    const averagePerSession = totalSessions > 0 ? totalMessages / totalSessions : 0;

    // Average messages by scenario (using filtered sessions)
    const averageByScenario: { [scenario: string]: number } = {};
    Object.keys(byScenario).forEach(scenario => {
      const scenarioSessions = sessions.filter(s => s.scenarioTitle === scenario);
      const scenarioMessages = scenarioSessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);
      averageByScenario[scenario] = scenarioSessions.length > 0 ? scenarioMessages / scenarioSessions.length : 0;
    });

    // Filter feedback to only include valid scenarios
    const validSessionIds = sessions.map(s => s.sessionId);
    const filteredFeedback = this.feedback.filter(f => 
      validScenarios.includes(f.scenarioTitle || '') || 
      validSessionIds.includes(f.sessionId)
    );

    // Overall satisfaction (using filtered feedback)
    const feedbackList = filteredFeedback.filter(f => f.overallScore);
    const overallAverage = feedbackList.length > 0 
      ? feedbackList.reduce((sum, f) => sum + (f.overallScore || 0), 0) / feedbackList.length 
      : 0;
    
    const overallDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbackList.forEach(f => {
      if (f.overallScore && f.overallScore >= 1 && f.overallScore <= 5) {
        overallDistribution[f.overallScore]++;
      }
    });

    // Satisfaction by scenario (using filtered feedback)
    const satisfactionByScenario: { [scenario: string]: { average: number; distribution: { [key: number]: number } } } = {};
    Object.keys(byScenario).forEach(scenario => {
      const scenarioFeedback = filteredFeedback.filter(f => f.scenarioTitle === scenario && f.overallScore);
      const average = scenarioFeedback.length > 0 
        ? scenarioFeedback.reduce((sum, f) => sum + (f.overallScore || 0), 0) / scenarioFeedback.length 
        : 0;
      
      const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      scenarioFeedback.forEach(f => {
        if (f.overallScore && f.overallScore >= 1 && f.overallScore <= 5) {
          distribution[f.overallScore]++;
        }
      });

      satisfactionByScenario[scenario] = { average, distribution };
    });

    // Future conversations overall (using filtered feedback)
    const futureOverall = { yes: 0, maybe: 0, no: 0 };
    filteredFeedback.forEach(f => {
      if (f.futureConversations === 'yes') futureOverall.yes++;
      else if (f.futureConversations === 'maybe') futureOverall.maybe++;
      else if (f.futureConversations === 'no') futureOverall.no++;
    });

    // Future conversations by scenario (using filtered feedback)
    const futureByScenario: { [scenario: string]: { yes: number; maybe: number; no: number } } = {};
    Object.keys(byScenario).forEach(scenario => {
      const scenarioFeedback = filteredFeedback.filter(f => f.scenarioTitle === scenario);
      const future = { yes: 0, maybe: 0, no: 0 };
      scenarioFeedback.forEach(f => {
        if (f.futureConversations === 'yes') future.yes++;
        else if (f.futureConversations === 'maybe') future.maybe++;
        else if (f.futureConversations === 'no') future.no++;
      });
      futureByScenario[scenario] = future;
    });

    // Sessions by lesson analytics (simplified for memory storage)
    const byLesson: { [lessonId: string]: { count: number; title: string; scenarios: { [scenario: string]: number } } } = {};
    const lessonsWithSessions = sessions.filter(session => session.lessonId && session.lessonId > 0);
    
    lessonsWithSessions.forEach(session => {
      const lessonId = session.lessonId!.toString();
      const lessonTitle = `Lesson ${session.lessonId}`;
      
      if (!byLesson[lessonId]) {
        byLesson[lessonId] = {
          count: 0,
          title: lessonTitle,
          scenarios: {}
        };
      }
      
      byLesson[lessonId].count++;
      const scenario = session.scenarioTitle;
      byLesson[lessonId].scenarios[scenario] = (byLesson[lessonId].scenarios[scenario] || 0) + 1;
    });

    return {
      users: { total: totalUsers },
      sessions: { total: totalSessions, perUser, byScenario, byEntryPoint, byLesson },
      messages: { averagePerSession, averageByScenario },
      satisfaction: { 
        overall: { average: overallAverage, distribution: overallDistribution },
        byScenario: satisfactionByScenario
      },
      futureConversations: { 
        overall: futureOverall,
        byScenario: futureByScenario
      }
    };
  }

  async getFeedbackComments(): Promise<{
    scenario: string;
    date: Date;
    comment: string;
  }[]> {
    return this.feedback
      .filter(f => f.comments && f.comments.trim().length > 0)
      .map(f => ({
        scenario: f.scenarioTitle || 'Unknown',
        date: f.createdAt || new Date(),
        comment: f.comments || ''
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by newest first
  }
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Database will be tested on first operation
  }

  // Helper method to get lesson title from lesson ID
  private getLessonTitle(lessonId: number): string {
    try {
      const mapping = LESSON_MAPPINGS.find((m) => m.shortId === lessonId);
      if (mapping) {
        // Return the full descriptive title from the mapping
        return mapping.title;
      } else {
        // If no mapping found, return a fallback that shows it's unmapped
        console.warn(`No lesson mapping found for lesson ID: ${lessonId}`);
        return `Lesson ${lessonId} (Unmapped)`;
      }
    } catch (error) {
      console.error(`Error loading lesson mapping for ID ${lessonId}:`, error);
      return `Lesson ${lessonId} (Error)`;
    }
  }

  // User management methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUserId(userId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.userId, userId));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUserLastActive(userId: string): Promise<User> {
    const result = await db.update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.userId, userId))
      .returning();
    return result[0];
  }

  // Chat session management methods
  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const result = await db.insert(chatSessions).values(insertSession).returning();
    return result[0];
  }

  async getChatSession(id: number): Promise<ChatSession | undefined> {
    const result = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
    return result[0];
  }

  async getChatSessionBySessionId(sessionId: string): Promise<ChatSession | undefined> {
    const result = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId));
    return result[0];
  }

  async updateChatSessionMessageCount(sessionId: string, messageCount: number): Promise<ChatSession> {
    const result = await db.update(chatSessions)
      .set({ messageCount })
      .where(eq(chatSessions.sessionId, sessionId))
      .returning();
    return result[0];
  }

  async markSessionAbandoned(sessionId: string): Promise<ChatSession> {
    const result = await db.update(chatSessions)
      .set({ 
        isAbandoned: true, 
        abandonedAt: new Date() 
      })
      .where(eq(chatSessions.sessionId, sessionId))
      .returning();
    return result[0];
  }

  async markSessionCompleted(sessionId: string, duration: number): Promise<ChatSession> {
    const result = await db.update(chatSessions)
      .set({ 
        completedAt: new Date(),
        duration 
      })
      .where(eq(chatSessions.sessionId, sessionId))
      .returning();
    return result[0];
  }

  // Chat message management methods
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(message).returning();
    return result[0];
  }

  async getChatMessages(chatSessionId: number): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages)
      .where(eq(chatMessages.chatSessionId, chatSessionId))
      .orderBy(chatMessages.messageOrder);
  }

  // Conversation feedback methods
  async createConversationFeedback(feedback: InsertConversationFeedback): Promise<ConversationFeedback> {
    const result = await db.insert(conversationFeedback).values(feedback).returning();
    return result[0];
  }

  async getConversationFeedback(sessionId: string): Promise<ConversationFeedback | undefined> {
    const result = await db.select().from(conversationFeedback)
      .where(eq(conversationFeedback.sessionId, sessionId));
    return result[0];
  }

  // Analytics methods
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllChatSessions(): Promise<ChatSession[]> {
    return await db.select().from(chatSessions);
  }

  async getAllConversationFeedback(): Promise<ConversationFeedback[]> {
    return await db.select().from(conversationFeedback);
  }

  async getUserSessions(userId: string): Promise<ChatSession[]> {
    return await db.select().from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(chatSessions.createdAt);
  }

  async getUserSessionsByEmail(email: string): Promise<ChatSession[]> {
    return await db.select().from(chatSessions)
      .where(eq(chatSessions.userEmail, email))
      .orderBy(chatSessions.createdAt);
  }

  async getSessionAnalytics(): Promise<{
    totalSessions: number;
    abandonedSessions: number;
    completedSessions: number;
    averageMessageCount: number;
    averageDuration: number;
  }> {
    const sessions = await this.getAllChatSessions();
    
    const totalSessions = sessions.length;
    const abandonedSessions = sessions.filter(s => s.isAbandoned).length;
    const completedSessions = sessions.filter(s => s.completedAt).length;
    
    const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);
    const averageMessageCount = totalSessions > 0 ? totalMessages / totalSessions : 0;
    
    const completedWithDuration = sessions.filter(s => s.duration);
    const totalDuration = completedWithDuration.reduce((sum, s) => sum + (s.duration || 0), 0);
    const averageDuration = completedWithDuration.length > 0 ? totalDuration / completedWithDuration.length : 0;

    return {
      totalSessions,
      abandonedSessions,
      completedSessions,
      averageMessageCount,
      averageDuration
    };
  }

  async getAdminMetrics(): Promise<{
    users: { total: number };
    sessions: { 
      total: number;
      perUser: number;
      byScenario: { [scenario: string]: number };
      byEntryPoint: { main_screen: number; lesson_end: number; other: number };
      byLesson: { [lessonId: string]: { count: number; title: string; scenarios: { [scenario: string]: number } } };
    };
    messages: {
      averagePerSession: number;
      averageByScenario: { [scenario: string]: number };
    };
    satisfaction: {
      overall: { average: number; distribution: { [key: number]: number } };
      byScenario: { [scenario: string]: { average: number; distribution: { [key: number]: number } } };
    };
    futureConversations: {
      overall: { yes: number; maybe: number; no: number };
      byScenario: { [scenario: string]: { yes: number; maybe: number; no: number } };
    };
  }> {
    const users = await this.getAllUsers();
    const allSessions = await this.getAllChatSessions();
    const feedback = await this.getAllConversationFeedback();

    // Filter to only include legitimate scenarios
    const validScenarios = [
      'Role play a situation',
      'Clarity rewriter', 
      'Quick quiz on this lesson',
      'Take the diagnostic quiz'
    ];
    
    const sessions = allSessions.filter(session => 
      validScenarios.includes(session.scenarioTitle)
    );

    // Count unique user IDs from actual chat sessions, not registered users
    const uniqueUserIds = new Set(sessions.map(session => session.userId).filter(id => id));
    const totalUsers = uniqueUserIds.size;
    const totalSessions = sessions.length;
    const perUser = totalUsers > 0 ? totalSessions / totalUsers : 0;

    // Sessions by scenario (only valid scenarios)
    const byScenario: { [scenario: string]: number } = {};
    sessions.forEach(session => {
      byScenario[session.scenarioTitle] = (byScenario[session.scenarioTitle] || 0) + 1;
    });

    // Sessions by entry point
    const byEntryPoint = { main_screen: 0, lesson_end: 0, other: 0 };
    sessions.forEach(session => {
      if (session.entryPoint === 'main_screen') byEntryPoint.main_screen++;
      else if (session.entryPoint === 'lesson_end') byEntryPoint.lesson_end++;
      else byEntryPoint.other++;
    });

    // Average messages per session
    const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);
    const averagePerSession = totalSessions > 0 ? totalMessages / totalSessions : 0;

    // Average messages by scenario
    const averageByScenario: { [scenario: string]: number } = {};
    Object.keys(byScenario).forEach(scenario => {
      const scenarioSessions = sessions.filter(s => s.scenarioTitle === scenario);
      const scenarioMessages = scenarioSessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);
      averageByScenario[scenario] = scenarioSessions.length > 0 ? scenarioMessages / scenarioSessions.length : 0;
    });

    // Filter feedback to only include valid scenarios
    const validSessionIds = sessions.map(s => s.sessionId);
    const filteredFeedback = feedback.filter(f => 
      validScenarios.includes(f.scenarioTitle || '') || 
      validSessionIds.includes(f.sessionId)
    );

    // Overall satisfaction (using filtered feedback)
    const feedbackList = filteredFeedback.filter(f => f.overallScore);
    const overallAverage = feedbackList.length > 0 
      ? feedbackList.reduce((sum, f) => sum + (f.overallScore || 0), 0) / feedbackList.length 
      : 0;
    
    const overallDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbackList.forEach(f => {
      if (f.overallScore && f.overallScore >= 1 && f.overallScore <= 5) {
        overallDistribution[f.overallScore]++;
      }
    });

    // Satisfaction by scenario (using filtered feedback)
    const satisfactionByScenario: { [scenario: string]: { average: number; distribution: { [key: number]: number } } } = {};
    Object.keys(byScenario).forEach(scenario => {
      const scenarioFeedback = filteredFeedback.filter(f => f.scenarioTitle === scenario && f.overallScore);
      const average = scenarioFeedback.length > 0 
        ? scenarioFeedback.reduce((sum, f) => sum + (f.overallScore || 0), 0) / scenarioFeedback.length 
        : 0;
      
      const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      scenarioFeedback.forEach(f => {
        if (f.overallScore && f.overallScore >= 1 && f.overallScore <= 5) {
          distribution[f.overallScore]++;
        }
      });

      satisfactionByScenario[scenario] = { average, distribution };
    });

    // Future conversations overall (using filtered feedback)
    const futureOverall = { yes: 0, maybe: 0, no: 0 };
    filteredFeedback.forEach(f => {
      if (f.futureConversations === 'yes') futureOverall.yes++;
      else if (f.futureConversations === 'maybe') futureOverall.maybe++;
      else if (f.futureConversations === 'no') futureOverall.no++;
    });

    // Future conversations by scenario (using filtered feedback)
    const futureByScenario: { [scenario: string]: { yes: number; maybe: number; no: number } } = {};
    Object.keys(byScenario).forEach(scenario => {
      const scenarioFeedback = filteredFeedback.filter(f => f.scenarioTitle === scenario);
      const future = { yes: 0, maybe: 0, no: 0 };
      scenarioFeedback.forEach(f => {
        if (f.futureConversations === 'yes') future.yes++;
        else if (f.futureConversations === 'maybe') future.maybe++;
        else if (f.futureConversations === 'no') future.no++;
      });
      futureByScenario[scenario] = future;
    });

    // Sessions by lesson analytics
    const byLesson: { [lessonId: string]: { count: number; title: string; scenarios: { [scenario: string]: number } } } = {};
    const lessonsWithSessions = sessions.filter(session => session.lessonId && session.lessonId > 0);
    
    lessonsWithSessions.forEach(session => {
      const lessonId = session.lessonId!.toString();
      const lessonTitle = this.getLessonTitle(session.lessonId!);
      
      if (!byLesson[lessonId]) {
        byLesson[lessonId] = {
          count: 0,
          title: lessonTitle,
          scenarios: {}
        };
      }
      
      byLesson[lessonId].count++;
      const scenario = session.scenarioTitle;
      byLesson[lessonId].scenarios[scenario] = (byLesson[lessonId].scenarios[scenario] || 0) + 1;
    });
    return {
      users: { total: totalUsers },
      sessions: { total: totalSessions, perUser, byScenario, byEntryPoint, byLesson },
      messages: { averagePerSession, averageByScenario },
      satisfaction: { 
        overall: { average: overallAverage, distribution: overallDistribution },
        byScenario: satisfactionByScenario
      },
      futureConversations: { 
        overall: futureOverall,
        byScenario: futureByScenario
      }
    };
  }

  async getFeedbackComments(): Promise<{
    scenario: string;
    date: Date;
    comment: string;
  }[]> {
    const feedbackWithComments = await db.select().from(conversationFeedback)
      .where(isNotNull(conversationFeedback.comments));
    
    return feedbackWithComments
      .filter(f => f.comments && f.comments.trim().length > 0)
      .map(f => ({
        scenario: f.scenarioTitle || 'Unknown',
        date: f.createdAt || new Date(),
        comment: f.comments || ''
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by newest first
  }
}

// Use database storage for production
export const storage = new DatabaseStorage();