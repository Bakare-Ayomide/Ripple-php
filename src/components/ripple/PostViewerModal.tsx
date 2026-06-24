import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { ChevronLeft, Eye, Flame, Share2, Send, VolumeX, Volume2 } from "lucide-react";
import { useToggleLike, useToggleSave, type PostWithProfile } from "@/hooks/usePosts";
import { useComments, useAddComment } from "@/hooks/useComments";
import RichCaption from "./RichCaption";
import { useCachedUrl, usePrefetchPostMedia } from "@/lib/mediaCache";

interface Props {
  post: PostWithProfile;
  onClose: () => void;
}

const formatCount = (n: any) => {
  if (n === undefined || n === null || isNaN(Number(n))) return "0";
  const num = Number(n);
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
};

const PostViewerModal = ({ post, onClose }: Props) => {
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const { data: comments } = useComments(post.id);
  const addComment = useAddComment();
  const videoRef = useRef<HTMLVideoElement>(null);

  const profile = post.profiles;
  const mediaUrls = post.image_url?.split(",").map((u) => u.trim()).filter(Boolean) || [];

  // Automatically prefetch all media for this post
  usePrefetchPostMedia(mediaUrls);

  // Retrieve cached URL for currently showing media item
  const activeMediaUrl = useCachedUrl(mediaUrls[currentMediaIdx]);

  const handleComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate({ postId: post.id, content: commentText.trim() });
    setCommentText("");
  };

  // Auto-play video when it becomes active
  useEffect(() => {
    if (post.media_type === "video" && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [currentMediaIdx, post.media_type]);

  const hashtags = post.caption?.match(/#\w+/g) || [];

  const goNextMedia = () => {
    if (currentMediaIdx < mediaUrls.length - 1) setCurrentMediaIdx(i => i + 1);
  };
  const goPrevMedia = () => {
    if (currentMediaIdx > 0) setCurrentMediaIdx(i => i - 1);
  };

  const handleMediaTap = (e: React.MouseEvent) => {
    if (mediaUrls.length <= 1) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) goPrevMedia();
    else if (x > (rect.width * 2) / 3) goNextMedia();
  };

  const handleSwipe = (_: any, info: PanInfo) => {
    if (info.offset.x < -50) goNextMedia();
    else if (info.offset.x > 50) goPrevMedia();
    if (info.offset.y > 120) onClose();
  };

  const isVideo = (url: string) => {
    return post.media_type === "video" || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
  };
  const isAudio = (url: string) => {
    return post.media_type === "audio" || /\.(mp3|wav|m4a|aac|flac)(\?|$)/i.test(url);
  };

  // Double-tap to like
  const lastTapRef = useRef(0);
  const [showHeart, setShowHeart] = useState(false);
  const handleDoubleTap = () => {
    if (!post.is_liked) toggleLike.mutate({ postId: post.id, isLiked: false });
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };
  const handleMediaClick = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleDoubleTap();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    handleMediaTap(e);
  };

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[24px]"
      style={{ zIndex: 99998 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full h-full sm:h-[85vh] max-w-[480px] mx-auto overflow-hidden sm:rounded-3xl backdrop-blur-xl bg-black/35 sm:border sm:border-white/10 shadow-glow"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.3}
        onDragEnd={handleSwipe}
      >
        {/* Full-screen media with swipe */}
        <motion.div
          className="absolute inset-0"
          drag={mediaUrls.length > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleSwipe}
          onClick={handleMediaClick}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMediaIdx}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              {mediaUrls.length > 0 ? (
                isVideo(mediaUrls[currentMediaIdx]) ? (
                  <div className="relative w-full h-full">
                    <video
                      key={`v-${currentMediaIdx}`}
                      ref={videoRef}
                      src={activeMediaUrl || mediaUrls[currentMediaIdx]}
                      autoPlay
                      loop
                      muted={isMuted}
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <button
                      id={`btn-unmute-modal-${currentMediaIdx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMuted(!isMuted);
                      }}
                      className="absolute bottom-5 left-5 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition-all z-20 border border-white/10"
                      title={isMuted ? "Unmute sound" : "Mute sound"}
                    >
                      {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
                    </button>
                  </div>
                ) : isAudio(mediaUrls[currentMediaIdx]) ? (
                  <div className="w-full h-full bg-gradient-to-br from-primary/40 to-accent/40 flex flex-col items-center justify-center gap-6 p-8">
                    <div className="w-32 h-32 rounded-full gradient-brand flex items-center justify-center shadow-glow animate-pulse">
                      <svg className="w-14 h-14 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
                    </div>
                    <audio src={activeMediaUrl || mediaUrls[currentMediaIdx]} controls autoPlay className="w-full max-w-sm" />
                  </div>
                ) : (
                  <img
                    src={activeMediaUrl || mediaUrls[currentMediaIdx]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="w-full h-full bg-card flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">No media</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {showHeart && (
              <motion.div
                initial={{ scale: 0, opacity: 0, rotate: -15 }}
                animate={{ scale: 1.2, opacity: 1, rotate: 0 }}
                exit={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.5, type: "spring" }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <svg className="w-32 h-32 drop-shadow-2xl text-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Media dots indicator */}
        {mediaUrls.length > 1 && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {mediaUrls.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentMediaIdx(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentMediaIdx ? "bg-white w-5" : "bg-white/40 w-2"
                }`}
              />
            ))}
          </div>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10 pointer-events-none" />

        {/* Back button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-20 w-11 h-11 rounded-full btn-liquid-glass-base btn-liquid-glass-secondary flex items-center justify-center text-white shadow-glow transition-all active:scale-90"
        >
          <ChevronLeft className="w-5.5 h-5.5" />
        </button>

        {/* Right-side action icons */}
        <div className="absolute right-4 bottom-[20%] z-20 flex flex-col items-center gap-5">
          <div className="flex flex-col items-center gap-1">
            <button className="w-12 h-12 rounded-full btn-liquid-glass-base btn-liquid-glass-secondary flex items-center justify-center shadow-glow transition-all active:scale-95">
              <Eye className="w-5.5 h-5.5 text-white" />
            </button>
            <span className="text-white text-[11px] font-display font-bold shadow-md">{formatCount(post.likes_count + (post.comments_count || 0))}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <motion.button
              whileTap={{ scale: 1.3 }}
              onClick={() => toggleLike.mutate({ postId: post.id, isLiked: !!post.is_liked })}
              className={`w-12 h-12 rounded-full btn-liquid-glass-base flex items-center justify-center shadow-glow transition-all active:scale-95 ${
                post.is_liked ? "btn-liquid-glass-primary text-accent shadow-glow-sm" : "btn-liquid-glass-secondary text-white"
              }`}
            >
              <svg className={`w-5.5 h-5.5 ${post.is_liked ? "text-accent fill-accent" : "text-white"}`} fill={post.is_liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </motion.button>
            <span className="text-white text-[11px] font-display font-bold shadow-md">{formatCount(post.likes_count)}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button className="w-12 h-12 rounded-full btn-liquid-glass-base btn-liquid-glass-secondary flex items-center justify-center shadow-glow transition-all active:scale-95">
              <Share2 className="w-5.5 h-5.5 text-white" />
            </button>
            <span className="text-white text-[11px] font-display font-bold shadow-md">{formatCount(post.comments_count || 0)}</span>
          </div>
        </div>

        {/* Bottom content overlay in beautiful translucent card */}
        <div className="absolute bottom-4 left-4 right-20 z-20 p-4 rounded-2xl backdrop-blur-md bg-black/45 border border-white/10 shadow-elevated">
          {hashtags.length > 0 && (
            <div className="mb-2">
              <span 
                className="inline-block px-3 py-1 rounded-full bg-primary/95 text-primary-foreground text-[10px] font-display font-extrabold uppercase tracking-wider cursor-pointer hover:bg-primary transition-colors"
                onClick={() => {
                  onClose();
                  navigate(`/hashtag/${hashtags[0].slice(1)}`);
                }}
              >
                #{hashtags[0].slice(1)}
              </span>
            </div>
          )}

          {post.caption && (
            <div className="mb-2.5 max-h-[120px] overflow-y-auto scrollbar-none">
              <RichCaption
                text={post.caption.replace(/#\w+/g, "").trim()}
                className="text-white font-display font-extrabold text-base leading-snug drop-shadow-lg block"
                hashtagClass="text-accent font-extrabold"
                mentionClass="text-accent font-extrabold"
              />
            </div>
          )}

          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="text-white/80 hover:text-white text-xs font-display font-bold cursor-pointer transition-colors"
                  onClick={() => {
                    onClose();
                    navigate(`/hashtag/${tag.slice(1)}`);
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-1.5 border-t border-white/10">
            <div 
              className="w-7 h-7 rounded-full overflow-hidden border border-white/20 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => {
                if (profile?.username) {
                  onClose();
                  navigate(`/user/${profile.username}`);
                }
              }}
            >
              <img src={profile?.avatar_url || ""} alt="" className="w-full h-full object-cover" />
            </div>
            <span 
              className="text-white/90 text-xs font-display font-bold truncate cursor-pointer hover:underline"
              onClick={() => {
                if (profile?.username) {
                  onClose();
                  navigate(`/user/${profile.username}`);
                }
              }}
            >
              @{profile?.username || "user"}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modal, document.body);
};

export default PostViewerModal;
