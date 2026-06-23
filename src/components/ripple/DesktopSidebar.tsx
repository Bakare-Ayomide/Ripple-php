import { Home, Compass, Search, Send, Zap, Plus, User, Settings, Shield } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useUnreadNotificationsCount, useUnreadMessagesCount } from "@/hooks/useNotifications";
import CreatePostModal from "./CreatePostModal";
import { useState } from "react";

const DesktopSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: unreadNotifs = 0 } = useUnreadNotificationsCount();
  const { data: unreadMsgs = 0 } = useUnreadMessagesCount();
  const [showCreate, setShowCreate] = useState(false);

  const navItems = [
    { icon: Home, path: "/", label: "Main Stream", badge: 0 },
    { icon: Search, path: "/search", label: "Dive", badge: 0 },
    { icon: Compass, path: "/explore", label: "Discover Waters", badge: 0 },
    { icon: Send, path: "/messages", label: "Channels", badge: unreadMsgs },
    { icon: Zap, path: "/activity", label: "Ripples", badge: unreadNotifs },
    { icon: User, path: "/profile", label: "Shore", badge: 0 },
  ];

  return (
    <>
      <aside className="hidden lg:flex fixed left-5 top-1/2 -translate-y-1/2 flex-col items-center gap-3.5 z-50 p-2">
        {/* Nav list of perfect circles */}
        <nav className="flex flex-col gap-3">
          {navItems.map(({ icon: Icon, path, label, badge }) => {
            const isActive = location.pathname === path;
            return (
              <Link key={path} to={path}
                className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all group
                  ${isActive
                    ? "btn-liquid-glass-base btn-liquid-glass-primary text-foreground shadow-glow"
                    : "btn-liquid-glass-base btn-liquid-glass-secondary text-foreground"
                  }`}
              >
                <Icon className="w-5.5 h-5.5 text-foreground" strokeWidth={isActive ? 2.5 : 1.5} />
                
                {/* Floating translucent glint label popping next to circle */}
                <div className="absolute left-16 px-3 py-1.5 rounded-xl text-xs font-display font-semibold pointer-events-none opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 backdrop-blur-xl bg-black/75 border border-white/10 shadow-elevated whitespace-nowrap z-50 text-white">
                  {label}
                </div>

                {badge > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center z-10">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : isActive ? (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white animate-pulse" />
                ) : null}
              </Link>
            );
          })}

          {/* Create button */}
          <button
            onClick={() => setShowCreate(true)}
            className="relative btn-liquid-glass-base btn-liquid-glass-primary flex items-center justify-center w-12 h-12 rounded-full text-foreground shadow-glow group my-1"
          >
            <Plus className="w-5.5 h-5.5 text-foreground" strokeWidth={2.5} />
            <div className="absolute left-16 px-3 py-1.5 rounded-xl text-xs font-display font-semibold pointer-events-none opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 backdrop-blur-xl bg-black/75 border border-white/10 shadow-elevated whitespace-nowrap z-50 text-white">
              Create a Drop
            </div>
          </button>

          {/* Admin link */}
          {isAdmin && (
            <Link to="/admin"
              className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all group
                ${location.pathname === "/admin"
                  ? "btn-liquid-glass-base btn-liquid-glass-primary text-foreground shadow-glow"
                  : "btn-liquid-glass-base btn-liquid-glass-secondary text-foreground"
                }`}
            >
              <Shield className="w-5.5 h-5.5 text-foreground" strokeWidth={location.pathname === "/admin" ? 2.5 : 1.5} />
              <div className="absolute left-16 px-3 py-1.5 rounded-xl text-xs font-display font-semibold pointer-events-none opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 backdrop-blur-xl bg-black/75 border border-white/10 shadow-elevated whitespace-nowrap z-50 text-white">
                Admin Settings
              </div>
            </Link>
          )}
        </nav>

        {/* Bottom Settings Button as perfect circle pointing to /settings */}
        <Link
          to="/settings"
          className={`relative btn-liquid-glass-base flex items-center justify-center w-12 h-12 rounded-full text-foreground shadow-glow mt-6 group ${
            location.pathname === "/settings" || location.pathname === "/profile"
              ? "btn-liquid-glass-primary shadow-glow animate-pulse"
              : "btn-liquid-glass-secondary"
          }`}
        >
          <Settings className="w-5.5 h-5.5 text-foreground" strokeWidth={1.5} />
          <div className="absolute left-16 px-3 py-1.5 rounded-xl text-xs font-display font-semibold pointer-events-none opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 backdrop-blur-xl bg-black/75 border border-white/10 shadow-elevated whitespace-nowrap z-50 text-white">
            Settings
          </div>
        </Link>
      </aside>
      <CreatePostModal open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
};

export default DesktopSidebar;
