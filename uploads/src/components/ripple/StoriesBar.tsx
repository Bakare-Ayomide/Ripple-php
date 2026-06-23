import { Bell, Plus, Music } from "lucide-react";
import { motion } from "framer-motion";
import { useStories } from "@/hooks/useStories";
import { useProfile } from "@/hooks/useProfile";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";
import StoryViewer from "./StoryViewer";
import StoryComposer from "./StoryComposer";

const StoryCircle = ({
  avatar,
  username,
  hasStory,
  isOwn,
  story,
  itemCount,
  onClick,
  onAddClick,
}: {
  avatar: string;
  username: string;
  hasStory?: boolean;
  isOwn?: boolean;
  story?: any;
  itemCount?: number;
  onClick?: () => void;
  onAddClick?: () => void;
}) => (
  <motion.div
    whileTap={{ scale: 0.92 }}
    onClick={onClick}
    className="relative flex-shrink-0 group cursor-pointer"
    title={username}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.();
      }
    }}
  >
    <div className={`w-14 h-14 lg:w-11 lg:h-11 rounded-full p-[1.5px] ${hasStory ? "bg-gradient-to-br from-[#10B981] to-[#0D5C56]" : isOwn ? "gradient-brand" : "bg-border/30"}`}>
      <div className="w-full h-full rounded-full bg-[#000] p-[1.2px] overflow-hidden flex items-center justify-center">
        {story ? (
          story.media_type === "text" ? (
            <div className={`w-full h-full rounded-full bg-gradient-to-tr ${story.image_url || "from-purple-600 via-pink-600 to-blue-600"} flex items-center justify-center text-[10px] text-white font-extrabold shadow-sm`}>
              Aa
            </div>
          ) : story.media_type === "video" ? (
            <div className="w-full h-full rounded-full overflow-hidden relative">
              <video src={story.image_url} className="w-full h-full rounded-full object-cover" muted playsInline autoPlay loop />
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded-full bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                  <svg className="w-1.5 h-1.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" stroke="none" />
                  </svg>
                </div>
              </div>
            </div>
          ) : story.media_type === "audio" ? (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white relative">
              <Music className="w-4 h-4 text-white" />
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center" />
            </div>
          ) : (
            <img src={story.thumbnail_url || story.image_url || avatar || ""} alt={username} className="w-full h-full rounded-full object-cover bg-secondary" />
          )
        ) : (
          <img src={avatar || ""} alt={username} className="w-full h-full rounded-full object-cover bg-secondary" />
        )}
      </div>
    </div>
    {itemCount && itemCount > 0 ? (
      <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#10b981] text-[8.5px] font-extrabold text-[#000] flex items-center justify-center z-10 border border-[#000] shadow-sm">
        {itemCount}
      </span>
    ) : null}
    {isOwn && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddClick?.();
        }}
        className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full gradient-brand flex items-center justify-center border-2 border-background cursor-pointer"
        title="Add/Post wave"
      >
        <Plus className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
      </button>
    )}
  </motion.div>
);

const StoriesBar = () => {
  const { data: storyGroups } = useStories();
  const { data: profile } = useProfile();
  const { data: unreadNotifs = 0 } = useUnreadNotificationsCount();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartIdx, setViewerStartIdx] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const location = useLocation();

  const openViewer = (idx: number) => {
    setViewerStartIdx(idx);
    setViewerOpen(true);
  };

  const isActivityActive = location.pathname === "/activity";

  return (
    <div className="flex-shrink-0 w-[72px] lg:w-[68px] h-[calc(100vh-3.5rem)] lg:h-screen sticky top-14 lg:top-0 z-10">
      <div className="flex flex-col items-center gap-3 py-3 px-1 h-full overflow-y-auto hide-scrollbar">
        {/* Notification bell styled with Liquid Glass */}
        <Link to="/activity" className="relative mb-1 block">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isActivityActive
              ? "btn-liquid-glass-base btn-liquid-glass-primary text-foreground shadow-glow"
              : "btn-liquid-glass-base btn-liquid-glass-secondary text-foreground"
          }`}>
            <Bell className="w-5.5 h-5.5 text-foreground" strokeWidth={1.5} />
          </div>
          {unreadNotifs > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center z-10 shadow-sm">
              {unreadNotifs > 99 ? "99+" : unreadNotifs}
            </span>
          )}
        </Link>

        {/* Own story */}
        {(() => {
          const ownGroupIndex = storyGroups?.findIndex((g: any) => g.user_id === profile?.user_id) ?? -1;
          const ownGroup = ownGroupIndex !== -1 ? storyGroups?.[ownGroupIndex] : null;
          const ownLatestStory = ownGroup?.stories?.[0];
          return (
            <StoryCircle
              avatar={profile?.avatar_url || ""}
              username="Your wave"
              isOwn
              story={ownLatestStory}
              itemCount={ownGroup?.stories?.length || 0}
              onClick={() => {
                if (ownGroupIndex !== -1) {
                  openViewer(ownGroupIndex);
                } else {
                  setComposerOpen(true);
                }
              }}
              onAddClick={() => setComposerOpen(true)}
            />
          );
        })()}

        {/* Other stories */}
        {storyGroups
          ?.filter((group: any) => group.user_id !== profile?.user_id)
          ?.map((group: any) => {
            const realIdx = storyGroups.findIndex((g: any) => g.user_id === group.user_id);
            const latestStory = group.stories?.[0];
            return (
              <StoryCircle
                key={group.user_id}
                avatar={group.profile?.avatar_url || ""}
                username={group.profile?.username || "user"}
                hasStory
                story={latestStory}
                itemCount={group.stories?.length || 0}
                onClick={() => openViewer(realIdx)}
              />
            );
          })}

        {/* Placeholder circles if no stories */}
        {(!storyGroups || storyGroups.length === 0) && (
          <>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="w-14 h-14 lg:w-12 lg:h-12 rounded-full bg-secondary/40 border-2 border-border flex-shrink-0" />
            ))}
          </>
        )}
      </div>

      {viewerOpen && storyGroups && storyGroups.length > 0 && (
        <StoryViewer
          groups={storyGroups}
          initialGroupIndex={viewerStartIdx}
          onClose={() => setViewerOpen(false)}
        />
      )}

      <StoryComposer open={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  );
};

export default StoriesBar;
