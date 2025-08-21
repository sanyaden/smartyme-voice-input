import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // Mobile app user ID
  email: text("email"), // Optional, for legacy support
  createdAt: timestamp("created_at").defaultNow(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: text("user_id").notNull(), // Mobile app user ID - now primary identifier
  scenarioTitle: text("scenario_title").notNull(),
  scenarioPrompt: text("scenario_prompt").notNull(),
  messageCount: integer("message_count").default(0),
  isAbandoned: boolean("is_abandoned").default(false),
  abandonedAt: timestamp("abandoned_at"),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // Session length in seconds
  entryPoint: text("entry_point"), // "main_screen" | "lesson_end" | null
  lessonId: integer("lesson_id"), // From webview parameter
  courseId: integer("course_id"), // From webview parameter
  source: text("source").default("webview"), // Default to "webview" since users come from mobile
  webviewEntryTimestamp: timestamp("webview_entry_timestamp"),
  userEmail: text("user_email"), // Optional, for legacy support only
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  chatSessionId: integer("chat_session_id").notNull().references(() => chatSessions.id),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  messageOrder: integer("message_order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversationFeedback = pgTable("conversation_feedback", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  scenarioTitle: text("scenario_title"),
  overallScore: integer("overall_score"), // 1-5 rating
  futureConversations: text("future_conversations"), // "yes", "maybe", "no"
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastActiveAt: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertConversationFeedbackSchema = createInsertSchema(conversationFeedback).omit({
  id: true,
  createdAt: true,
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  chatSessions: many(chatSessions),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.userId],
  }),
  messages: many(chatMessages),
  feedback: many(conversationFeedback),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chatSession: one(chatSessions, {
    fields: [chatMessages.chatSessionId],
    references: [chatSessions.id],
  }),
}));

export const conversationFeedbackRelations = relations(conversationFeedback, ({ one }) => ({
  chatSession: one(chatSessions, {
    fields: [conversationFeedback.sessionId],
    references: [chatSessions.sessionId],
  }),
}));

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ConversationFeedback = typeof conversationFeedback.$inferSelect;
export type InsertConversationFeedback = z.infer<typeof insertConversationFeedbackSchema>;
