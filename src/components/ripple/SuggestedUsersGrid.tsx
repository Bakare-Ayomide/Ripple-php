import { useState, useRef } from "react";
import { useSuggestedUsers, useToggleFollow, useFollowStatus } from "@/hooks/useFollows";
import { X } from "lucide-react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

const FollowButton = ({ userId }: { userId: string }) => {
  const { data: isFollowing } = useFollowStatus(userId);
  const toggleFollow = useToggleFollow();

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation();
        toggleFollow.mutate({ targetId: userId, isFollowing: !!isFollowing });
      }}
      className={`px-4 py-1.5 rounded-lg text-[11px] font-display font-extrabold tracking-wide transition-all ${
        isFollowing
          ? "bg-secondary text-foreground border border-border"
          : "bg-foreground text-background"
      }`}
    >
      {isFollowing ? "Flowing" : "Flow"}
    </motion.button>
  );
};

const STACK_COLORS = [
  "bg-gradient-to-br from-emerald-500/20 to-emerald-400/10 border border-emerald-500/40 backdrop-blur-md",
  "bg-gradient-to-br from-emerald-600/20 to-emerald-500/10 border border-emerald-500/30 backdrop-blur-md",
  "bg-gradient-to-br from-emerald-700/20 to-emerald-600/10 border border-emerald-500/20 backdrop-blur-md",
];

const SwipeableCardDeck = ({ users }: { users: any[] }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const [dragX, setDragX] = useState(0);
  const constraintsRef = useRef(null);

  const visibleUsers = users.slice(currentIdx, currentIdx + 4);
  const activeUser = visibleUsers[0];

  const haptic = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { 
        (navigator as any).vibrate?.(15); 
      } catch (e) {
        // Ignore vibration errors gracefully
      }
    }
  };

  const handleSwipe = (_: any, info: PanInfo) => {
    setDragX(0);
    if (Math.abs(info.offset.x) > 80) {
      haptic();
      setExitDirection(info.offset.x > 0 ? "right" : "left");
      setTimeout(() => {
        setCurrentIdx((i) => Math.min(i + 1, users.length - 1));
        setExitDirection(null);
      }, 220);
    }
  };

  const handleDismiss = () => {
    haptic();
    setExitDirection("left");
    setTimeout(() => {
      setCurrentIdx((i) => Math.min(i + 1, users.length - 1));
      setExitDirection(null);
    }, 220);
  };

  if (!activeUser || currentIdx >= users.length) return null;

  return (
    <div className="relative w-[160px] flex-shrink-0" style={{ height: "260px" }} ref={constraintsRef}>
      {/* Background stacked cards with bright tucked color */}
      {visibleUsers.slice(1, 4).reverse().map((_, stackIdx) => {
        const actualIdx = 3 - stackIdx;
        const rotation = actualIdx * 4;
        const xShift = actualIdx * 7;
        const yShift = actualIdx * 5;
        return (
          <motion.div
            key={`stack-${stackIdx}`}
            className={`absolute inset-0 rounded-2xl shadow-lg ${STACK_COLORS[(actualIdx - 1) % STACK_COLORS.length]}`}
            initial={false}
            animate={{
              rotate: rotation + dragX * 0.02 * actualIdx,
              x: xShift + dragX * 0.05 * actualIdx,
              y: yShift,
              scale: 1 - actualIdx * 0.04,
            }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            style={{ zIndex: actualIdx }}
          />
        );
      })}

      {/* Active top card */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeUser.user_id}
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.25)] border border-emerald-500/30 backdrop-blur-xl touch-none"
          style={{ zIndex: 10 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDrag={(_, info) => setDragX(info.offset.x)}
          onDragEnd={handleSwipe}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            x: exitDirection === "left" ? -250 : exitDirection === "right" ? 250 : 0,
            rotate: exitDirection === "left" ? -18 : exitDirection === "right" ? 18 : 0,
          }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          whileTap={{ scale: 0.98 }}
          whileDrag={{ cursor: "grabbing", scale: 1.02 }}
        >
          {/* Emerald green background */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950/90" />

          {/* Glassy shimmer reflection glare */}
          <div className="absolute top-0.5 inset-x-2 h-[25%] rounded-b-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none z-10" />

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 z-20 w-5 h-5 rounded-full bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center border border-emerald-500/30"
          >
            <X className="w-3 h-3 text-emerald-300" />
          </button>

          {/* Top text */}
          <div className="relative z-10 pt-3 px-3 text-center">
            <p className="text-sm font-display font-extrabold text-foreground leading-tight truncate">
              {activeUser.display_name || activeUser.username || "User"}
            </p>
            <p className="text-[10px] text-emerald-400 font-medium flex items-center justify-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Connecting
            </p>
          </div>

          {/* User photo */}
          <div className="relative z-10 flex justify-center mt-2 px-4">
            <div className="w-[100px] h-[100px] rounded-xl overflow-hidden border-2 border-emerald-500/30 shadow-md">
              <img
                src={activeUser.avatar_url || ""}
                alt={activeUser.username}
                className="w-full h-full object-cover bg-secondary"
              />
            </div>
          </div>

          {/* Bottom info bar */}
          <div className="absolute bottom-0 inset-x-0 z-10 bg-emerald-950/90 backdrop-blur-md px-2.5 py-2 flex items-center gap-2 border-t border-emerald-500/20">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-500/20 flex-shrink-0">
              <img
                src={activeUser.avatar_url || ""}
                alt={activeUser.username}
                className="w-full h-full object-cover bg-secondary"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-display font-bold text-foreground truncate">
                @{activeUser.username || "user"}
              </p>
              <p className="text-[9px] text-muted-foreground truncate">
                {activeUser.bio ? activeUser.bio.slice(0, 20) : "Suggested for you"}
              </p>
            </div>
            <FollowButton userId={activeUser.user_id} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const SuggestedUsersGrid = () => {
  const { data: users } = useSuggestedUsers();

  if (!users || users.length === 0) return null;

  // Split users into groups of ~5 for multiple decks
  const decks: any[][] = [];
  for (let i = 0; i < Math.min(users.length, 15); i += 3) {
    decks.push(users.slice(i, i + 3));
  }

  return (
    <div className="mb-4 relative z-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-display font-extrabold text-base text-foreground">
          Find Crew
        </h3>
        <button className="text-xs font-display font-bold text-primary">
          See all
        </button>
      </div>
      <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-4 px-1">
        {decks.map((deck, i) => (
          <SwipeableCardDeck key={i} users={deck} />
        ))}
      </div>
    </div>
  );
};

export default SuggestedUsersGrid;
