import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Share2, MoreHorizontal, Flame, Send, Pencil, Pin, VolumeX, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToggleLike, useToggleSave, type PostWithProfile } from "@/hooks/usePosts";
import { useComments, useAddComment } from "@/hooks/useComments";
import { formatDistanceToNow } from "date-fns";
import RichCaption from "./RichCaption";
import VerifiedBadge from "./VerifiedBadge";
import { useCachedUrl, usePrefetchPostMedia } from "@/lib/mediaCache";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const formatNumber = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
};

const CachedImage = ({ src, className, alt = "" }: { src: string; className?: string; alt?: string }) => {
  const cachedUrl = useCachedUrl(src);
  return <img src={cachedUrl || src} alt={alt} className={className} />;
};

const PostCard = ({ post, featured = false, onOpen }: { post: PostWithProfile; featured?: boolean; onOpen?: () => void }) => {
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState(true);
  const [showHeart, setShowHeart] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [showHashtags, setShowHashtags] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [hashtagSearch, setHashtagSearch] = useState("");

  const TRENDING_HASHTAGS = [
    "#DigitalArt", "#NightVibes", "#CodeLife", "#Wanderlust",
    "#Photography", "#Music", "#Travel", "#Fitness",
    "#FoodPorn", "#OOTD", "#Motivation", "#Gaming",
    "#Ripple", "#Trending", "#Viral", "#Creative",
  ];

  const filteredHashtags = hashtagSearch && hashtagSearch.length > 1
    ? TRENDING_HASHTAGS.filter((t) =>
        t.toLowerCase().includes(hashtagSearch.replace("#", "").toLowerCase())
      )
    : TRENDING_HASHTAGS;

  const { data: mentionUsers } = useQuery({
    queryKey: ["mention-users-comment", mentionSearch],
    queryFn: async () => {
      const search = mentionSearch.replace("@", "").trim();
      const q = supabase.from("profiles").select("user_id, username, display_name, avatar_url");
      if (!search) {
        const { data } = await q.limit(6);
        return data || [];
      } else {
        const { data } = await q.ilike("username", `%${search}%`).limit(6);
        return data || [];
      }
    },
    enabled: showMentions,
  });

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCommentText(val);
    const cursor = e.target.selectionStart || 0;
    const textBefore = val.slice(0, cursor);
    const lastWord = textBefore.split(/\s/).pop() || "";

    if (lastWord.startsWith("@") && lastWord.length >= 1) {
      setMentionSearch(lastWord);
      setShowMentions(true);
      setShowHashtags(false);
    } else if (lastWord.startsWith("#") && lastWord.length >= 1) {
      setHashtagSearch(lastWord);
      setShowHashtags(true);
      setShowMentions(false);
    } else {
      setShowMentions(false);
      setShowHashtags(false);
    }
  };

  const insertCommentText = (text: string) => {
    const pos = commentText.split(/\s/);
    pos[pos.length - 1] = text;
    setCommentText(pos.join(" ") + " ");
    setShowMentions(false);
    setShowHashtags(false);
  };
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const { data: comments } = useComments(showComments ? post.id : "");
  const addComment = useAddComment();

  // Parse multiple media URLs
  const mediaUrls = post.image_url?.split(",").map((u) => u.trim()).filter(Boolean) || [];

  // Automatically prefetch all media in this post
  usePrefetchPostMedia(mediaUrls);

  // Get cached local URL for primary media
  const leadMediaUrl = useCachedUrl(mediaUrls[0]);

  const handleDoubleTap = () => {
    if (!post.is_liked) {
      toggleLike.mutate({ postId: post.id, isLiked: false });
    }
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate({ postId: post.id, content: commentText.trim() });
    setCommentText("");
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: false });
  const profile = post.profiles;

  return (
    <article
      className={`rounded-3xl overflow-hidden mb-4 border transition-all relative z-0 ${
        featured
          ? "backdrop-blur-xl bg-[#064e3b]/85 border-[#10b981]/40 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          : "backdrop-blur-xl bg-[#042f2c]/60 border-[#0d5c56]/25 shadow-lg shadow-[#021c1a]/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <img
          src={profile?.avatar_url || ""}
          alt={profile?.username || ""}
          className="w-12 h-12 rounded-full object-cover bg-secondary border-2 border-background cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => {
            if (profile?.username) navigate(`/user/${profile.username}`);
          }}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-display font-extrabold truncate flex items-center gap-1 cursor-pointer hover:underline ${featured ? "text-primary-foreground" : "text-foreground"}`}
            onClick={() => {
              if (profile?.username) navigate(`/user/${profile.username}`);
            }}
          >
            {profile?.display_name || profile?.username || "User"}
            <VerifiedBadge verified={(profile as any)?.is_verified} size={14} />
          </p>
          <p
            className={`text-xs font-medium cursor-pointer hover:underline ${featured ? "text-primary-foreground/60" : "text-muted-foreground"}`}
            onClick={() => {
              if (profile?.username) navigate(`/user/${profile.username}`);
            }}
          >
            @{profile?.username || "user"}
          </p>
        </div>
        <span className={`text-xs font-semibold ${featured ? "text-primary-foreground/50" : "text-muted-foreground"}`}>{timeAgo}</span>
      </div>

      {/* Caption with clickable hashtags/mentions */}
      {post.caption && (
        <div className="px-4 pb-3">
          <RichCaption
            text={post.caption}
            className={`text-sm leading-relaxed font-medium ${featured ? "text-primary-foreground font-bold" : "text-foreground/80"}`}
            hashtagClass="text-primary font-bold cursor-pointer hover:underline"
            mentionClass="text-accent font-bold cursor-pointer hover:underline"
          />
        </div>
      )}

      {/* Media area - overlapping thumbnails for multi-image */}
      {mediaUrls.length > 0 && (
        <div className="relative mx-4 mb-3 rounded-2xl overflow-hidden cursor-pointer" onDoubleClick={handleDoubleTap} onClick={onOpen}>
          {/* Main image */}
          {(() => {
            const url = leadMediaUrl || mediaUrls[0];
            const isVid = post.media_type === "video" || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
            const isAud = post.media_type === "audio" || /\.(mp3|wav|m4a|aac|flac)(\?|$)/i.test(url);
             if (isVid) return (
              <div className="relative w-full aspect-[4/5]">
                <video
                  src={url}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                />
                
                <button
                  id={`btn-unmute-post-${post.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="absolute bottom-3 left-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition-all z-15 border border-white/10"
                  title={isMuted ? "Unmute sound" : "Mute sound"}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            );
            if (isAud) return (
              <div className="w-full aspect-[4/5] bg-gradient-to-br from-accent/30 to-primary/30 flex flex-col items-center justify-center gap-4 p-6">
                <div className="w-24 h-24 rounded-full gradient-brand flex items-center justify-center shadow-glow">
                  <svg className="w-10 h-10 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
                </div>
                <audio src={url} controls className="w-full max-w-xs" />
              </div>
            );
            return <img src={url} alt="Post" className="w-full aspect-[4/5] object-cover" />;
          })()}

          {/* Multi-image overlay indicator */}
          {mediaUrls.length > 1 && (
            <div className="absolute bottom-3 right-3 flex items-center -space-x-2">
              {mediaUrls.slice(1, 4).map((url, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-lg overflow-hidden border-2 border-card shadow-md"
                  style={{ zIndex: 3 - i }}
                >
                  <CachedImage src={url} className="w-full h-full object-cover" />
                </div>
              ))}
              {mediaUrls.length > 4 && (
                <div className="w-10 h-10 rounded-lg bg-black/60 backdrop-blur-sm border-2 border-card flex items-center justify-center">
                  <span className="text-white text-[10px] font-display font-bold">+{mediaUrls.length - 4}</span>
                </div>
              )}
            </div>
          )}

          {/* Multi-image dot indicator top */}
          {mediaUrls.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
              <span className="text-white text-[10px] font-display font-bold">1/{mediaUrls.length}</span>
            </div>
          )}

          <AnimatePresence>
            {showHeart && (
              <motion.div
                initial={{ scale: 0, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.4, type: "spring" }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Flame className="w-24 h-24 text-accent drop-shadow-lg" fill="hsl(330 80% 60%)" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 1.3 }}
            onClick={() => toggleLike.mutate({ postId: post.id, isLiked: !!post.is_liked })}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              post.is_liked ? "bg-accent/20" : featured ? "bg-primary-foreground/10" : "bg-secondary"
            }`}
          >
            <Flame className={`w-5 h-5 ${post.is_liked ? "fill-accent text-accent" : featured ? "text-primary-foreground" : "text-foreground"}`} />
          </motion.button>
          <button onClick={() => setShowComments(!showComments)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${featured ? "bg-primary-foreground/10" : "bg-secondary"}`}>
            <Pencil className={`w-5 h-5 ${featured ? "text-primary-foreground" : "text-foreground"}`} />
          </button>
          <button onClick={() => toggleSave.mutate({ postId: post.id, isSaved: !!post.is_saved })} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${featured ? "bg-primary-foreground/10" : "bg-secondary"}`}>
            <Pin className={`w-5 h-5 ${post.is_saved ? "fill-primary text-primary" : featured ? "text-primary-foreground" : "text-foreground"}`} />
          </button>
        </div>
        <button className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${featured ? "bg-primary-foreground/10" : "bg-secondary"}`}>
          <Share2 className={`w-5 h-5 ${featured ? "text-primary-foreground" : "text-foreground"}`} />
        </button>
      </div>

      {post.likes_count > 0 && (
        <div className="px-4 pb-2">
          <p className={`text-xs font-display font-bold ${featured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatNumber(post.likes_count)} splashes</p>
        </div>
      )}

      {post.comments_count > 0 && (
        <div className="px-4 pb-3">
          <button onClick={() => setShowComments(!showComments)} className={`text-xs font-semibold ${featured ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
            Listen to all {formatNumber(post.comments_count)} echoes
          </button>
        </div>
      )}

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 pt-3 border-t border-border/30 space-y-3 max-h-48 overflow-y-auto">
              {comments?.map((c: any) => (
                <div key={c.id} className="flex gap-2 items-start">
                  <img
                    src={c.profiles?.avatar_url || ""}
                    className="w-7 h-7 rounded-full bg-secondary flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      if (c.profiles?.username) navigate(`/user/${c.profiles.username}`);
                    }}
                  />
                  <div>
                    <span
                      className={`text-xs font-display font-bold cursor-pointer hover:underline inline-block mr-1.5 ${featured ? "text-primary-foreground" : "text-foreground"}`}
                      onClick={() => {
                        if (c.profiles?.username) navigate(`/user/${c.profiles.username}`);
                      }}
                    >
                      {c.profiles?.username}
                    </span>
                    <span className={`text-xs ${featured ? "text-primary-foreground/70" : "text-secondary-foreground"}`}>{c.content}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="relative px-4 py-3">
              {/* Mentions dropdown */}
              <AnimatePresence>
                {showMentions && mentionUsers && mentionUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-4 right-4 top-full mt-1 bg-card border border-border rounded-2xl shadow-elevated max-h-40 overflow-y-auto z-20 animate-fade-in"
                  >
                    {mentionUsers.map((u: any) => (
                      <button
                        key={u.user_id}
                        onClick={() => insertCommentText(`@${u.username}`)}
                        className="w-full text-left px-4 py-2 flex items-center gap-2.5 hover:bg-secondary/80 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                      >
                        <img src={u.avatar_url || ""} alt="" className="w-6 h-6 rounded-full bg-secondary" />
                        <div>
                          <p className="text-xs font-display font-bold text-foreground">@{u.username}</p>
                          <p className="text-[10px] text-muted-foreground">{u.display_name}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hashtags dropdown */}
              <AnimatePresence>
                {showHashtags && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-4 right-4 top-full mt-1 bg-card border border-border rounded-2xl shadow-elevated max-h-40 overflow-y-auto z-20 animate-fade-in"
                  >
                    {filteredHashtags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => insertCommentText(tag)}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-primary hover:bg-secondary/80 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2">
                <input
                  value={commentText}
                  onChange={handleCommentChange}
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                  placeholder="Echo your thoughts..."
                  className={`flex-1 rounded-full px-4 py-2 text-xs outline-none ${featured ? "bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/40" : "bg-secondary text-foreground placeholder:text-muted-foreground"}`}
                />
                <button onClick={handleComment} disabled={!commentText.trim()} className="w-9 h-9 rounded-full gradient-brand text-primary-foreground flex items-center justify-center disabled:opacity-50">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
};

export default PostCard;
