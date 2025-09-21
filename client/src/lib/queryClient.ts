import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Helper function for API requests
export async function apiRequest(method: string, endpoint: string, body?: any, options?: RequestInit) {
  const response = await fetch(endpoint, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "flutter-app-secure-key", // Authentication for API endpoints
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API request failed: ${response.statusText}`);
  }

  return response.json();
}