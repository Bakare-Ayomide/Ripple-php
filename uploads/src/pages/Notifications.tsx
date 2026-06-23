import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, UserPlus, Send, Bell, CheckCheck, AtSign, Eye, Bookmark, Loader2, X } from "lucide-react";
import { useNotifications, useMarkNotificationsRead } from "@/hooks/useNotifications";
import { usePost } from "@/hooks/usePosts";
import VerifiedBadge from "@/components/ripple/VerifiedBadge";
import PostViewerModal from "@/components/ripple/PostViewerModal";
import { toast } from "sonner";

const ICONS: Record<string, any> = {
  like: { Icon: Heart, color: "text-rose-500", text: "splashed your Drop" },
  comment: { Icon: MessageCircle, color: "text-primary", text: "echoed on your Drop" },
  follow: { Icon: UserPlus, color: "text-emerald-500", text: "joined your crew" },
  message: { Icon: Send, color: "text-accent", text: "bubbled you in a channel" },
  mention: { Icon: AtSign, color: "text-primary", text: "rippled you in a Drop" },
  story_view: { Icon: Eye, color: "text-amber-500", text: "surfed your Wave" },
  save_post: { Icon: Bookmark, color: "text-violet-500", text: "anchored your Drop" },
};

const Notifications = () => {
  const navigate = useNavigate();
  const { data: notifs, isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [viewingPostId, setViewingPostId] = useState<string | null>(null);
  const { data: viewingPost, isLoading: isLoadingPost } = usePost(viewingPostId);

  useEffect(() => {
    if (notifs?.some((n: any) => !n.is_read)) {
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifs?.length]);

  useEffect(() => {
    if (viewingPostId && !isLoadingPost && !viewingPost) {
      toast.error("This post is no longer available.");
      setViewingPostId(null);
    }
  }, [viewingPostId, isLoadingPost, viewingPost]);

  return (
    <div className="max-w-[700px] mx-auto px-3 pt-4 lg:pt-6 pb-24 lg:pb-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center shadow-glow">
            <Bell className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-2xl text-foreground">Ripples</h1>
            <p className="text-sm text-muted-foreground">Splashes, echoes, tides & channels</p>
          </div>
        </div>
        <Link
          to="/"
          className="w-10 h-10 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-all"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !notifs?.length ? (
        <div className="text-center py-16">
          <CheckCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-display font-bold text-lg text-foreground">You're all caught up</p>
          <p className="text-sm text-muted-foreground">New activity will show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n: any) => {
            const meta = ICONS[n.type] || ICONS.like;
            const Icon = meta.Icon;
            const hasPost = !!n.post_id;
            const to = n.type === "follow"
              ? `/user/${n.actor?.username || ""}`
              : n.type === "message"
                ? "/messages"
                : "/";

            return (
              <Link
                key={n.id}
                to={to}
                onClick={(e) => {
                  if (hasPost) {
                    e.preventDefault();
                    setViewingPostId(n.post_id);
                  }
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${
                  n.is_read
                    ? "bg-card border-border"
                    : "bg-secondary/60 border-primary/30"
                }`}
              >
                <div className="relative">
                  <img
                    src={n.actor?.avatar_url || ""}
                    alt=""
                    className="w-11 h-11 rounded-xl bg-secondary object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (n.actor?.username) navigate(`/user/${n.actor.username}`);
                    }}
                  />
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center ${meta.color}`}>
                    <Icon className="w-3 h-3" fill={n.type === "like" ? "currentColor" : "none"} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground flex items-center flex-wrap gap-1">
                    <span 
                      className="font-display font-bold inline-flex items-center gap-1 cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (n.actor?.username) navigate(`/user/${n.actor.username}`);
                      }}
                    >
                      {n.actor?.username || "someone"}
                      {n.actor?.is_verified && <VerifiedBadge verified size={12} />}
                    </span>{" "}
                    <span className="text-muted-foreground">{meta.text}</span>
                  </p>
                  {n.content && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">"{n.content}"</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {viewingPostId === n.post_id && isLoadingPost ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                ) : !n.is_read ? (
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                ) : null}
              </Link>
            );
          })}
        </div>
      )}

      {viewingPost && (
        <PostViewerModal
          post={viewingPost}
          onClose={() => setViewingPostId(null)}
        />
      )}
    </div>
  );
};

export default Notifications;