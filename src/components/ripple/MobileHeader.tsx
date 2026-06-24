import { Settings, Shield } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useAdmin";

const MobileHeader = () => {
  const location = useLocation();
  const { data: isAdmin } = useIsAdmin();

  const isSettingsActive = location.pathname === "/settings" || location.pathname === "/profile";
  const isAdminActive = location.pathname === "/admin";

  return (
    <div className="lg:hidden fixed top-4 right-4 z-50 flex items-center gap-2">
      {isAdmin && (
        <Link
          to="/admin"
          className={`btn-liquid-glass-base w-11 h-11 rounded-full flex items-center justify-center shadow-glow transition-all hover:scale-105 active:scale-95 text-foreground ${
            isAdminActive ? "btn-liquid-glass-primary shadow-glow" : "btn-liquid-glass-secondary"
          }`}
          aria-label="Admin Settings"
        >
          <Shield className="w-5 h-5 text-foreground" strokeWidth={1.5} />
        </Link>
      )}
      <Link
        to="/settings"
        className={`btn-liquid-glass-base w-11 h-11 rounded-full flex items-center justify-center shadow-glow transition-all hover:scale-105 active:scale-95 text-foreground ${
          isSettingsActive ? "btn-liquid-glass-primary shadow-glow" : "btn-liquid-glass-secondary"
        }`}
        aria-label="Settings"
      >
        <Settings className="w-5 h-5 text-foreground" strokeWidth={1.5} />
      </Link>
    </div>
  );
};

export default MobileHeader;
