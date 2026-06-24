import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Share2, MoreHorizontal, Flame, Send, Pencil, Pin, VolumeX, Volume2, Compass, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToggleLike, useToggleSave, useUpdatePost, useDeletePost, type PostWithProfile } from "@/hooks/usePosts";
import { useIsAdmin } from "@/hooks/useAdmin";
import { Calendar, Clock, Lock, Trash2, Check, ShieldAlert } from "lucide-react";
import { useComments, useAddComment } from "@/hooks/useComments";
import { formatDistanceToNow } from "date-fns";
import RichCaption from "./RichCaption";
import VerifiedBadge from "./VerifiedBadge";
import { useCachedUrl, usePrefetchPostMedia } from "@/lib/mediaCache";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PropagationGraph } from "./PropagationGraph";
import { resolveUrl } from "@/utils/api";

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
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scheduled / editing states
  const { data: isAdmin } = useIsAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState(post.caption || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();

  const handleUpdate = async () => {
    if (!editedCaption.trim()) return toast.error("Caption cannot be empty");
    setIsUpdating(true);
    try {
      await updatePost.mutateAsync({
        postId: post.id,
        caption: editedCaption,
      });
      toast.success("Post updated successfully!");
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update post");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete/cancel this post?")) return;
    try {
      await deletePost.mutateAsync(post.id);
      toast.success("Post deleted successfully");
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete post");
    }
  };

  const handleModerate = async (approved: boolean) => {
    try {
      await updatePost.mutateAsync({
        postId: post.id,
        is_moderated: approved,
      });
      toast.success(approved ? "Post approved!" : "Post unapproved!");
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to moderate post");
    }
  };

  const handleDirectRepost = async () => {
    if (!user) {
      toast.error("You must be logged in to repost waves.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(resolveUrl("/api/propagation/share"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          userId: user.id,
          shareType: "repost"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to repost");
      
      toast.success("Successfully reposted to your feed!");
      setIsShareOpen(false);
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuoteSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in to quote waves.");
      return;
    }
    if (!quoteText.trim()) {
      toast.error("Please add a caption to quote.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(resolveUrl("/api/propagation/share"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          userId: user.id,
          shareType: "quote",
          caption: quoteText
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to quote");
      
      toast.success("Successfully quoted wave!");
      setIsShareOpen(false);
      setIsQuoting(false);
      setQuoteText("");
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
      {post.share_type === 'repost' && (
        <div className="flex items-center gap-1.5 px-4 pt-3.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
          <Share2 className="w-3.5 h-3.5" />
          reposted wave
        </div>
      )}
      {post.share_type === 'quote' && (
        <div className="flex items-center gap-1.5 px-4 pt-3.5 text-[10px] font-bold text-teal-400 uppercase tracking-widest">
          <Pencil className="w-3.5 h-3.5" />
          quoted wave
        </div>
      )}
      {/* Scheduled/Locked Info Banner */}
      {(post.status === 'scheduled' || post.is_time_capsule || (post as any).is_locked_capsule) && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-secondary/40 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            {post.status === 'scheduled' && (
              <>
                <Calendar className="w-4 h-4 text-primary" />
                <span>
                  Scheduled for {new Date(post.scheduled_for!).toLocaleString()}
                  {post.is_recurring && ` (Recurring: ${post.recurrence_interval})`}
                </span>
              </>
            )}
            {(post.is_time_capsule || (post as any).is_locked_capsule) && (
              <>
                <Lock className="w-4 h-4 text-accent" />
                <span>
                  Time Capsule {post.is_locked_capsule ? "(Locked)" : "(Unlocked)"} (Unlocks {new Date(post.unlocks_at!).toLocaleString()})
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Show Edit button if owner or admin */}
            {(user?.id === post.user_id || isAdmin) && (
              <>
                <button
                  onClick={() => {
                    setIsEditing(!isEditing);
                    setEditedCaption(post.caption || "");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-foreground transition-all flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> {isEditing ? "Cancel" : "Edit"}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-[10px] font-bold text-red-400 transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Cancel
                </button>
              </>
            )}

            {/* Admin Moderation controls */}
            {isAdmin && post.status === 'scheduled' && (
              <div className="flex items-center gap-1.5 border-l border-white/5 pl-2">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Admin:</span>
                <button
                  onClick={() => handleModerate(!post.is_moderated)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all flex items-center gap-0.5 ${
                    post.is_moderated
                      ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                      : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                  }`}
                  title={post.is_moderated ? "Approved - Click to Reject" : "Pending Approval - Click to Approve"}
                >
                  {post.is_moderated ? <Check className="w-2.5 h-2.5" /> : <ShieldAlert className="w-2.5 h-2.5" />}
                  {post.is_moderated ? "Approved" : "Moderate"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
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

      {/* Caption with clickable hashtags/mentions / inline editor */}
      {isEditing ? (
        <div className="px-4 pb-3.5 space-y-2 animate-fade-in">
          <textarea
            value={editedCaption}
            onChange={(e) => setEditedCaption(e.target.value)}
            className="w-full bg-[#011413]/70 rounded-2xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary w-full border border-white/5 resize-none"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-bold text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="px-4 py-1.5 rounded-xl gradient-brand text-primary-foreground text-xs font-extrabold transition-all flex items-center gap-1 shadow-glow"
            >
              {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      ) : (
        post.caption && post.caption !== "[REPOST]" && (
          <div className="px-4 pb-3">
            <RichCaption
              text={post.caption}
              className={`text-sm leading-relaxed font-medium ${featured ? "text-primary-foreground font-bold" : "text-foreground/80"}`}
              hashtagClass="text-primary font-bold cursor-pointer hover:underline"
              mentionClass="text-accent font-bold cursor-pointer hover:underline"
            />
          </div>
        )
      )}

      {/* Nested Quoted/Reposted Post */}
      {(post as any).parent_post && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if ((post as any).parent_post?.username) {
              navigate(`/user/${(post as any).parent_post.username}`);
            }
          }}
          className="mx-4 mb-3.5 p-3.5 rounded-2xl bg-[#011413]/50 border border-[#0d5c56]/30 hover:border-primary/40 transition-all cursor-pointer flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <img
              src={(post as any).parent_post.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${(post as any).parent_post.user_id}`}
              className="w-6 h-6 rounded-full object-cover border border-border/80"
              alt="Avatar"
            />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-foreground truncate">{(post as any).parent_post.display_name}</span>
              <span className="text-[10px] text-muted-foreground truncate">@{(post as any).parent_post.username}</span>
            </div>
          </div>
          {(post as any).parent_post.caption && (post as any).parent_post.caption !== "[REPOST]" && (
            <p className="text-xs text-muted-foreground/95 line-clamp-3 leading-relaxed">
              {(post as any).parent_post.caption}
            </p>
          )}
          {(post as any).parent_post.image_url && (
            <div className="mt-1 rounded-xl overflow-hidden aspect-[16/9] bg-black/40 border border-border/30">
              <img
                src={(post as any).parent_post.image_url.split(",")[0].trim()}
                alt="Quoted media"
                className="w-full h-full object-cover"
              />
            </div>
          )}
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
        <button
          id={`btn-share-${post.id}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsShareOpen(true);
          }}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${featured ? "bg-primary-foreground/10" : "bg-secondary"}`}
        >
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

      {/* Share Actions Modal */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="max-w-md bg-[#042f2c] border-[#0d5c56]/30 backdrop-blur-md rounded-2xl p-5 text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-lg flex items-center gap-1.5 text-foreground">
              <Share2 className="w-5 h-5 text-primary" /> Reflect Wave
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-black/20 border border-border/40">
              <img src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.user_id}`} className="w-8 h-8 rounded-full object-cover border border-border/80" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">@{post.profiles?.username}</p>
                <p className="text-xs text-muted-foreground truncate">{post.caption && post.caption !== "[REPOST]" ? post.caption : "Direct wave media"}</p>
              </div>
            </div>

            {isQuoting ? (
              <div className="flex flex-col gap-2 mt-1">
                <label className="text-xs font-semibold text-muted-foreground">Add your thoughts</label>
                <textarea
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  placeholder="What's your take on this wave?"
                  className="w-full h-24 p-3 bg-black/20 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60 resize-none"
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    onClick={() => setIsQuoting(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleQuoteSubmit}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Reflect Quote
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 mt-2">
                <button
                  onClick={handleDirectRepost}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15 transition-all text-xs font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-primary" /> Instant Repost
                  </span>
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase font-bold">Standard</span>
                </button>

                <button
                  onClick={() => setIsQuoting(true)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15 transition-all text-xs font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-emerald-400" /> Quote Wave
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase font-bold">Add Thoughts</span>
                </button>

                <button
                  onClick={() => {
                    setIsShareOpen(false);
                    setIsGraphOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary border border-border hover:bg-secondary/80 transition-all text-xs font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-foreground/80" /> View Propagation Tree
                  </span>
                  <span className="text-[10px] bg-muted-foreground/10 text-muted-foreground px-2 py-0.5 rounded-full uppercase font-bold">D3 Interactive</span>
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Propagation Interactive Graph Modal */}
      <Dialog open={isGraphOpen} onOpenChange={setIsGraphOpen}>
        <DialogContent className="max-w-5xl bg-[#042f2c] border-[#0d5c56]/30 backdrop-blur-lg rounded-2xl p-6 overflow-y-auto max-h-[90vh] text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-lg flex items-center gap-1.5 text-foreground border-b border-border/30 pb-3">
              <Share2 className="w-5 h-5 text-primary" /> Wave Reflection Analytics & Propagation Tree
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <PropagationGraph postId={post.id} onClose={() => setIsGraphOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
};

export default PostCard;
