import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { WebViewProvider } from "@/contexts/WebViewContext";
import { useEffect } from "react";

import MainPage from "@/pages/main";
import LessonPage from "@/pages/lesson";
import LessonOverviewPage from "@/pages/lesson-overview";
import AiTutorPage from "@/pages/ai-tutor";
import CongratulationsPage from "@/pages/congratulations";
import ChatPage from "@/pages/chat";
import ChatFeedbackPage from "@/pages/chat-feedback";
import ProfilePage from "@/pages/profile";
import WelcomePage from "@/pages/welcome";
import WebViewPage from "@/pages/webview";
import VoiceTutorPage from "@/pages/voice-tutor";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/welcome" component={WelcomePage} />
      <Route path="/webview" component={WebViewPage} />
      <Route path="/voice-tutor" component={VoiceTutorPage} />
      <Route path="/lessons" component={MainPage} />
      <Route path="/" component={AiTutorPage} />
      <Route path="/lesson-overview/:id" component={LessonOverviewPage} />
      <Route path="/lesson/:id" component={LessonPage} />
      <Route path="/lesson/:id/part/:part" component={LessonPage} />
      <Route path="/ai-tutor" component={AiTutorPage} />
      <Route path="/ai-tutor/post-lesson/:lessonId" component={AiTutorPage} />
      <Route path="/congratulations/:lessonId" component={CongratulationsPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/chat/feedback" component={ChatFeedbackPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  const isAdminPage = location.startsWith("/admin");
  
  // Apply admin-page class to body for admin routes
  useEffect(() => {
    if (isAdminPage) {
      document.body.classList.add("admin-page");
    } else {
      document.body.classList.remove("admin-page");
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove("admin-page");
    };
  }, [isAdminPage]);
  
  return (
    <div className={isAdminPage ? "admin-container" : "mobile-container"}>
      <Router />
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WebViewProvider>
          <TooltipProvider>
            <AppContent />
          </TooltipProvider>
        </WebViewProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
