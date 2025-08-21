import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface UseChatOptions {
  scenario?: {
    title: string;
    prompt: string;
  };
  onError?: (error: Error) => void;
}

export function useChat({ scenario, onError }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!scenario) {
        throw new Error("No scenario provided");
      }

      const response = await apiRequest("POST", "/api/chat/message", {
        message,
        prompt: scenario.prompt,
        conversationHistory: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.message || "AI service failed");
        (error as any).retryable = errorData.retryable;
        (error as any).status = response.status;
        throw error;
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setLastFailedMessage(null); // Clear failed message on success
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date()
        }
      ]);
    },
    onError: (error: any) => {
      // Handle AI service unavailable - redirect to lessons
      if (error.status === 503 || error.status === 502) {
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
      onError?.(error as Error);
    }
  });

  const sendMessage = useCallback((content: string) => {
    const userMessage: ChatMessage = {
      role: "user",
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setLastFailedMessage(content); // Store message for potential retry
    sendMessageMutation.mutate(content);
  }, [sendMessageMutation]);

  const retryLastMessage = useCallback(() => {
    if (lastFailedMessage) {
      sendMessageMutation.mutate(lastFailedMessage);
    }
  }, [lastFailedMessage, sendMessageMutation]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const initializeChat = useCallback((welcomeMessages: string[]) => {
    const initialMessages: ChatMessage[] = welcomeMessages.map(content => ({
      role: "assistant" as const,
      content,
      timestamp: new Date()
    }));
    setMessages(initialMessages);
  }, []);

  return {
    messages,
    sendMessage,
    retryLastMessage,
    clearMessages,
    initializeChat,
    isLoading: sendMessageMutation.isPending,
    error: sendMessageMutation.error,
    canRetry: lastFailedMessage !== null && (sendMessageMutation.error as any)?.retryable
  };
}
