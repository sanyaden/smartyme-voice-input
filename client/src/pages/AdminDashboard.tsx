import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Star, Users, MessageSquare, BarChart3, RefreshCw, LogOut, Clock } from "lucide-react";

interface AdminMetrics {
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
}

interface FeedbackComment {
  scenario: string;
  date: Date;
  comment: string;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        setLocation("/admin");
        return;
      }

      const response = await fetch("/api/admin/metrics", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else if (response.status === 401) {
        localStorage.removeItem("adminToken");
        setLocation("/admin");
        toast({
          title: "Session expired",
          description: "Please login again",
          variant: "destructive",
        });
      } else {
        throw new Error("Failed to fetch metrics");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load metrics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        setLocation("/admin");
        return;
      }

      const response = await fetch("/api/admin/comments", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Convert date strings to Date objects
        const commentsWithDates = data.map((comment: any) => ({
          ...comment,
          date: new Date(comment.date)
        }));
        setComments(commentsWithDates);
      } else if (response.status === 401) {
        localStorage.removeItem("adminToken");
        setLocation("/admin");
        toast({
          title: "Session expired",
          description: "Please login again",
          variant: "destructive",
        });
      } else {
        throw new Error("Failed to fetch comments");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchComments();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setLocation("/admin");
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= Math.round(rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
        <span className="ml-2 text-sm text-gray-800 dark:text-gray-300">
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Failed to load metrics</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              AI Communication Platform Analytics
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => { fetchMetrics(); fetchComments(); }} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="w-5 h-5 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-300">
                    Total Users
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {metrics.users.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <MessageSquare className="w-5 h-5 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-300">
                    Total Sessions
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {metrics.sessions.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-300">
                    Sessions per User
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {metrics.sessions.perUser.toFixed(1)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Star className="w-5 h-5 text-yellow-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-300">
                    Average Rating
                  </p>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {renderStars(metrics.satisfaction.overall.average)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Sessions by Scenario */}
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg font-semibold leading-none tracking-tight">Sessions by Scenario</CardTitle>
              <CardDescription>
                Number of conversations started for each scenario type
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {Object.entries(metrics.sessions.byScenario).map(([scenario, count]) => (
                  <div key={scenario} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-300 truncate mr-2">
                      {scenario}
                    </span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Entry Points */}
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg font-semibold leading-none tracking-tight">Session Entry Points</CardTitle>
              <CardDescription>
                How users start conversations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-300">Main Screen</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {metrics.sessions.byEntryPoint.main_screen}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-300">End of Lesson</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {metrics.sessions.byEntryPoint.lesson_end}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-300">Other</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {metrics.sessions.byEntryPoint.other}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Messages Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg font-semibold leading-none tracking-tight">Average Messages per Session</CardTitle>
              <CardDescription>
                Overall: {metrics.messages.averagePerSession.toFixed(1)} messages
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {Object.entries(metrics.messages.averageByScenario).map(([scenario, avg]) => (
                  <div key={scenario} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-300 truncate mr-2">
                      {scenario}
                    </span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {avg.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Future Conversations */}
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg font-semibold leading-none tracking-tight">Future Conversation Interest</CardTitle>
              <CardDescription>
                "Would you like more conversations like this?"
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-600">Yes</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {metrics.futureConversations.overall.yes}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-yellow-600">Maybe</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {metrics.futureConversations.overall.maybe}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-red-600">No</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {metrics.futureConversations.overall.no}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Satisfaction by Scenario */}
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-lg font-semibold leading-none tracking-tight">Satisfaction by Scenario</CardTitle>
            <CardDescription>
              Star ratings and distribution for each conversation type
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-1 gap-4">
              {Object.entries(metrics.satisfaction.byScenario).map(([scenario, data]) => (
                <div key={scenario} className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2 text-gray-800 dark:text-gray-300 truncate">{scenario}</h4>
                  <div className="mb-2">
                    {renderStars(data.average)}
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-400">
                    Distribution: 
                    {[1, 2, 3, 4, 5].map(star => (
                      <span key={star} className="ml-2">
                        {star}★: {data.distribution[star] || 0}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Conversations by Lesson */}
        <Card className="mt-6">
          <CardHeader className="p-4">
            <CardTitle className="text-lg font-semibold leading-none tracking-tight">Conversations by Lesson</CardTitle>
            <CardDescription>
              Which lessons trigger the most tutor conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {Object.keys(metrics.sessions.byLesson || {}).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(metrics.sessions.byLesson)
                  .sort(([,a], [,b]) => b.count - a.count) // Sort by most conversations
                  .slice(0, 10) // Show top 10 lessons
                  .map(([lessonId, data]) => (
                  <div key={lessonId} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-sm text-gray-800 dark:text-gray-300">
                        {data.title}
                      </h4>
                      <span className="text-sm font-bold text-blue-600">
                        {data.count} conversations
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Lesson ID: {lessonId}
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-400 mt-1">
                      Scenarios: {Object.entries(data.scenarios).map(([scenario, count]) => (
                        <span key={scenario} className="mr-3">
                          {scenario}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                No lesson-triggered conversations yet. Conversations will appear here when users start tutoring sessions after completing lessons.
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Comments Section */}
        <Card className="mt-6">
          <CardHeader className="p-4">
            <CardTitle className="text-lg font-semibold leading-none tracking-tight">User Feedback Comments</CardTitle>
            <CardDescription>
              Text comments from users after conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {commentsLoading ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                <span>Loading comments...</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-6 text-gray-600 dark:text-gray-400">
                No user comments available yet
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {comments.map((comment, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {comment.scenario}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <Clock className="w-3 h-3" />
                          {comment.date.toLocaleDateString()} {comment.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-300 leading-relaxed">
                      "{comment.comment}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}