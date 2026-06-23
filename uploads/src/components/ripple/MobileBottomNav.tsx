import { Home, Search, Plus, MessageSquare, User } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import CreatePostModal from "./CreatePostModal";
import { useState } from "react";
import { useUnreadMessagesCount } from "@/hooks/useNotifications";

const MobileBottomNav = () => {
  const location = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const { data: unread = 0 } = useUnreadMessagesCount();

  const navItems: Array<{ icon: any; path: string; label: string; isCreate?: boolean; badge?: number }> = [
    { icon: Home, path: "/", label: "Main Stream" },
    { icon: Search, path: "/explore", label: "Discover Waters" },
    { icon: Plus, path: "/create", label: "Create a Drop", isCreate: true },
    { icon: MessageSquare, path: "/messages", label: "Channels", badge: unread },
    { icon: User, path: "/profile", label: "Shore" },
  ];

  return (
    <>
      <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm">
        {/* Transparent layout wrapper with no background box - allowing circles to hover freely above app pages */}
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map(({ icon: Icon, path, label, isCreate, badge }) => {
            const isActive = location.pathname === path;

            if (isCreate) {
              return (
                <button
                  key={path}
                  aria-label={label}
                  onClick={() => setShowCreate(true)}
                  className="btn-liquid-glass-base btn-liquid-glass-primary w-12 h-12 rounded-full flex items-center justify-center shadow-glow transition-all active:scale-95"
                >
                  <Plus className="w-5.5 h-5.5 text-foreground" strokeWidth={2.5} />
                </button>
              );
            }

            return (
              <Link
                key={path}
                to={path}
                aria-label={label}
                className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                  isActive
                    ? "btn-liquid-glass-base btn-liquid-glass-primary text-foreground shadow-glow"
                    : "btn-liquid-glass-base btn-liquid-glass-secondary text-foreground"
                }`}
              >
                <Icon
                  className="w-5 h-5 text-foreground"
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                {badge !== undefined && badge > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center z-20 shadow-sm">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
      <CreatePostModal open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
};

export default MobileBottomNav;
