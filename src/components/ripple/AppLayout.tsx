import { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import DesktopSidebar from "./DesktopSidebar";
import MobileBottomNav from "./MobileBottomNav";
import MobileHeader from "./MobileHeader";
import { useAuth } from "@/contexts/AuthContext";

const AppLayout = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user) return;

    const handleScroll = (e: Event) => {
      const target = e.target;
      if (!target) return;

      let scrollTop = 0;
      if (target === document || target === window.document) {
        scrollTop = window.scrollY || document.documentElement.scrollTop;
      } else if (target instanceof HTMLElement) {
        scrollTop = target.scrollTop;
      }

      // Max scroll distance threshold for transitions
      const threshold = 320;
      const progress = Math.min(scrollTop / threshold, 1);

      // Slightly scale down from 1.0 to 0.92
      const scale = 1 - progress * 0.08;
      // Slightly decrease background opacity / increase translucency from 1.0 down to 0.72
      const translucency = 1 - progress * 0.28;

      document.body.style.setProperty("--scroll-nav-scale", scale.toString());
      document.body.style.setProperty("--scroll-nav-translucency", translucency.toString());
    };

    // Use capture phase to intercept scrolling on any scrollable column or modal
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [user]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (!user) return <Navigate to="/auth" replace />;

  if (user.user_metadata?.needs_onboarding === true) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar />
      <MobileHeader />
      <main className="lg:ml-[96px] xl:ml-[112px] pb-0 lg:pb-0 px-4 md:px-8 py-6">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
};

export default AppLayout;
