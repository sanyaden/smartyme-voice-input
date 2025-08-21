import BottomNavigation from "@/components/bottom-navigation";
import { Card, CardContent } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/use-page-title";

export default function ProfilePage() {
  usePageTitle("Profile");
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
      <div className="px-4 py-6 pb-24">
        <h1 className="text-2xl font-bold text-gray-800 mb-8">Profile</h1>
        
        {/* Grey placeholder for profile content */}
        <div className="space-y-6">
          <Card className="bg-gray-100 rounded-2xl border-0">
            <CardContent className="p-6">
              <div className="w-20 h-20 bg-gray-300 rounded-full mx-auto mb-4"></div>
              <h2 className="text-center font-semibold text-gray-800">Your Profile</h2>
              <p className="text-center text-gray-600 text-sm">Manage your learning preferences</p>
            </CardContent>
          </Card>
          
          <div className="space-y-3">
            <Card className="bg-gray-100 rounded-xl border-0">
              <CardContent className="p-4">
                <p className="font-medium text-gray-800">Learning Progress</p>
                <p className="text-sm text-gray-600">Track your communication skills journey</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-100 rounded-xl border-0">
              <CardContent className="p-4">
                <p className="font-medium text-gray-800">Settings</p>
                <p className="text-sm text-gray-600">Customize your experience</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-100 rounded-xl border-0">
              <CardContent className="p-4">
                <p className="font-medium text-gray-800">Support</p>
                <p className="text-sm text-gray-600">Get help when you need it</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <BottomNavigation currentPage="profile" />
    </div>
  );
}
