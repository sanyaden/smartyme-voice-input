// Debug configuration for console logging

const DEBUG = {
  // Enable/disable debug logging
  enabled: import.meta.env.DEV && import.meta.env.MODE !== 'production',
  
  // Specific debug flags
  voice: false, // Voice input debugging
  flutter: false, // Flutter bridge debugging
  chat: false, // Chat functionality debugging
  webview: false, // WebView specific debugging
};

// Debug logger that can be toggled
export function debugLog(category: keyof typeof DEBUG, ...args: any[]) {
  if (DEBUG.enabled && DEBUG[category]) {
    console.log(...args);
  }
}

// Export debug config for runtime changes
export { DEBUG };