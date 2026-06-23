import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/ripple/AppLayout";
import Feed from "./pages/Feed";
import Explore from "./pages/Explore";
import Profile from "./pages/Profile";
import Messages from "./pages/Messages";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import HashtagPage from "./pages/HashtagPage";
import UserProfile from "./pages/UserProfile";
import VerifiedUsers from "./pages/VerifiedUsers";
import Notifications from "./pages/Notifications";

const queryClient = new QueryClient();

const BackgroundManager = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/onboarding") {
      document.body.classList.add("onboarding-bg");
    } else {
      document.body.classList.remove("onboarding-bg");
    }
  }, [location.pathname]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <BackgroundManager />
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<Admin />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Feed />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Profile />} />
              <Route path="/search" element={<Explore />} />
              <Route path="/create" element={<Feed />} />
              <Route path="/activity" element={<Notifications />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/hashtag/:tag" element={<HashtagPage />} />
              <Route path="/user/:username" element={<UserProfile />} />
              <Route path="/verified" element={<VerifiedUsers />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
