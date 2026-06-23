import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X, Send, UserPlus, ChevronDown, Volume2, VolumeX } from "lucide-react";

import RichCaption from "./RichCaption";
import { useCachedUrl } from "@/lib/mediaCache";

type Story = {
  id: string;
  image_url: string;
  media_type?: string | null;
  thumbnail_url?: string | null;
  created_at: string;
  views_count: number | null;
  caption?: string | null;
};

type StoryGroup = {
  user_id: string;
  profile: { username: string; display_name: string; avatar_url: string } | null;
  stories: Story[];
};

interface StoryViewerProps {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

const STORY_DURATION = 5000;

const StoryViewer = ({ groups, initialGroupIndex, onClose }: StoryViewerProps) => {
  const navigate = useNavigate();
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [dragY, setDragY] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef(Date.now());

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const cachedStoryUrl = useCachedUrl(story?.image_url);

  const resetTimer = useCallback(() => {
    setProgress(0);
    startTimeRef.current = Date.now();
  }, []);

  const goNext = useCallback(() => {
    if (!group) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((s) => s + 1);
      resetTimer();
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
      resetTimer();
    } else {
      onClose();
    }
  }, [group, storyIdx, groupIdx, groups.length, onClose, resetTimer]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((s) => s - 1);
      resetTimer();
    } else if (groupIdx > 0) {
      setGroupIdx((g) => g - 1);
      setStoryIdx(0);
      resetTimer();
    }
  }, [storyIdx, groupIdx, resetTimer]);

  useEffect(() => {
    if (paused) return;
    startTimeRef.current = Date.now() - (progress / 100) * STORY_DURATION;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) goNext();
    }, 30);
    return () => clearInterval(timerRef.current);
  }, [groupIdx, storyIdx, paused, goNext]);

  const handleTap = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) goPrev();
    else goNext();
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100) onClose();
    else if (info.offset.x < -50) goNext();
    else if (info.offset.x > 50) goPrev();
    setDragY(0);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!group || !story) return null;
  const profile = group.profile;
  const timeAgo = (() => {
    const mins = Math.floor((Date.now() - new Date(story.created_at).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  })();

  const viewer = (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black flex items-center justify-center"
        style={{ zIndex: 99999 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full h-full max-w-[480px] mx-auto"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.4}
          onDrag={(_, info) => setDragY(info.offset.y)}
          onDragEnd={handleDragEnd}
          style={{ opacity: 1 - Math.abs(dragY) / 400 }}
        >
          {/* Full-screen story media */}
          <div
            className="absolute inset-0 cursor-pointer overflow-hidden flex items-center justify-center bg-zinc-950"
            onClick={handleTap}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          >
            {(!story.media_type || story.media_type === "image") && (
              <img
                src={cachedStoryUrl || story.image_url}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
            )}

            {story.media_type === "video" && (
              <video
                src={cachedStoryUrl || story.image_url}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                loop
                muted={isMuted}
                draggable={false}
              />
            )}

            {story.media_type === "audio" && (
              <div className="w-full h-full bg-gradient-to-br from-neutral-900 to-zinc-900 flex flex-col items-center justify-center p-6 gap-6 relative">
                {/* Visualizer animation / rotating wave disk */}
                <div className="relative flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                    className="w-40 h-40 rounded-full border-4 border-emerald-500/30 flex items-center justify-center bg-emerald-500/10 shadow-lg relative overflow-hidden"
                  >
                    <div className="absolute inset-2 rounded-full border border-white/10" />
                    <div className="absolute inset-5 rounded-full border border-white/5" />
                    <div className="absolute inset-8 rounded-full border border-white/10" />
                    <div className="absolute inset-12 rounded-full border border-white/5" />
                    <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                      </svg>
                    </div>
                  </motion.div>
                </div>

                {/* Wave animation */}
                <div className="flex gap-1.5 items-end h-8">
                  {[1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((h, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: ["4px", `${h * 4}px`, "4px"] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.05, ease: "easeInOut" }}
                      className="w-1 bg-emerald-500 rounded-full"
                    />
                  ))}
                </div>

                <audio
                  src={cachedStoryUrl || story.image_url}
                  autoPlay
                  playsInline
                  loop
                  muted={isMuted}
                />
              </div>
            )}

            {story.media_type === "text" && (
              <div 
                className={`w-full h-full bg-gradient-to-tr ${story.image_url || "from-purple-600 via-pink-600 to-blue-600"} flex flex-col items-center justify-center p-8 text-center select-none`}
              >
                <div className="max-w-xs break-words">
                  <h3 className="text-white text-2xl sm:text-3xl font-display font-extrabold tracking-tight leading-snug drop-shadow-md">
                    {story.caption}
                  </h3>
                </div>
              </div>
            )}

            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          </div>

          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 px-3 pt-3">
            {group.stories.map((_, i) => (
              <div key={i} className="flex-1 h-[2.5px] rounded-full bg-white/25 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-none"
                  style={{
                    width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-7 left-0 right-0 z-10 flex items-center justify-between px-4">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/50 shadow-lg cursor-pointer hover:opacity-95 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  if (profile?.username) {
                    onClose();
                    navigate(`/user/${profile.username}`);
                  }
                }}
              >
                <img src={profile?.avatar_url || ""} alt="" className="w-full h-full object-cover" />
              </div>
              <div
                className="cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  if (profile?.username) {
                    onClose();
                    navigate(`/user/${profile.username}`);
                  }
                }}
              >
                <p className="text-white font-display font-extrabold text-sm leading-tight drop-shadow-lg">
                  {profile?.display_name || profile?.username || "User"}
                </p>
                <p className="text-white/50 text-[11px] font-medium">{timeAgo}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(story.media_type === "video" || story.media_type === "audio") && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors mr-1"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="w-4.5 h-4.5" />
                  ) : (
                    <Volume2 className="w-4.5 h-4.5" />
                  )}
                </button>
              )}
              <button className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-accent text-accent-foreground text-[11px] font-display font-extrabold shadow-md">
                <UserPlus className="w-3 h-3" />
                Flow
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                title="Close"
              >
                <X className="w-6 h-6" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Swipe down indicator */}
          <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 animate-bounce">
            <ChevronDown className="w-5 h-5 text-white/40" />
          </div>

          {/* Right side actions */}
          <div className="absolute right-4 bottom-24 z-10 flex flex-col items-center gap-4">
            <button className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Send className="w-5 h-5 text-white" />
            </button>
            <button className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
          </div>

          {/* Story caption with hashtags/mentions (only for non-text stories) */}
          {story.caption && story.media_type !== "text" && (
            <div className="absolute left-4 right-20 bottom-24 z-10">
              <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-4 py-2.5 inline-block max-w-full">
                <RichCaption
                  text={story.caption}
                  className="text-white text-base font-display font-bold drop-shadow leading-snug block"
                  hashtagClass="text-accent font-extrabold cursor-pointer"
                  mentionClass="text-primary font-extrabold cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Reply bar */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-6">
            <div className="flex gap-2 items-center">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                placeholder="Reply Wave..."
                className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm rounded-full px-4 py-3 placeholder:text-white/40 outline-none focus:border-white/40"
              />
              <button className="w-11 h-11 rounded-full bg-accent flex items-center justify-center shadow-md">
                <Send className="w-5 h-5 text-accent-foreground" style={{ transform: "rotate(-30deg)" }} />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  // Portal to document.body so it overlays EVERYTHING
  return createPortal(viewer, document.body);
};

export default StoryViewer;
