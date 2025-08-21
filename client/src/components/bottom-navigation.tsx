import { useLocation } from "wouter";
import { Home, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BottomNavigationProps {
  currentPage?: "home" | "profile";
}

export default function BottomNavigation({ currentPage }: BottomNavigationProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="fixed-bottom-container bg-white border-t border-gray-200 px-4 py-3">
      <div className="flex justify-around">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className={`flex flex-col items-center space-y-1 p-2 ${
            currentPage === "home" ? "text-gray-800" : "text-gray-600"
          }`}
        >
          <Home className="h-5 w-5" />
          <span className="text-xs font-medium">For you</span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => setLocation("/profile")}
          className={`flex flex-col items-center space-y-1 p-2 ${
            currentPage === "profile" ? "text-gray-800" : "text-gray-600"
          }`}
        >
          <User className="h-5 w-5" />
          <span className="text-xs font-medium">Profile</span>
        </Button>
      </div>
      <div className="home-indicator mt-2"></div>
    </div>
  );
}
