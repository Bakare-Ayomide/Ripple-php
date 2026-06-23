import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePosts, type PostWithProfile } from "@/hooks/usePosts";
import { useFollowStatus, useToggleFollow, useFollowCounts } from "@/hooks/useFollows";
import PostCard from "@/components/ripple/PostCard";
import PostViewerModal from "@/components/ripple/PostViewerModal";
import RichCaption from "@/components/ripple/RichCaption";
import { ChevronLeft } from "lucide-react";
import VerifiedBadge from "@/components/ripple/VerifiedBadge";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";

const UserProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [viewingPost, setViewingPost] = useState<PostWithProfile | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      return data;
    },
    enabled: !!username,
  });

  const { data: isFollowing } = useFollowStatus(profile?.user_id || "");
  const toggleFollow = useToggleFollow();
  const { data: counts } = useFollowCounts(profile?.user_id || "");
  const { data: allPosts } = usePosts();

  const userPosts = allPosts?.filter((p) => p.user_id === profile?.user_id) || [];

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="font-display font-extrabold text-foreground text-lg flex items-center gap-1">
          @{profile.username}
          <VerifiedBadge verified={(profile as any).is_verified} size={16} />
        </h1>
      </div>

      {/* Profile info */}
      <div className="px-5 pt-6 pb-4 flex flex-col items-center text-center">
        <img
          src={profile.avatar_url || ""}
          alt=""
          className="w-20 h-20 rounded-full object-cover bg-secondary border-2 border-primary/30 mb-3"
        />
        <p className="font-display font-extrabold text-xl text-foreground flex items-center gap-1.5">
          {profile.display_name || profile.username}
          <VerifiedBadge verified={(profile as any).is_verified} size={18} />
        </p>
        <p className="text-sm text-muted-foreground mb-3">@{profile.username}</p>
        {profile.bio && (
          <div className="text-sm text-foreground/70 mb-4 max-w-xs">
            <RichCaption text={profile.bio} />
          </div>
        )}

        <div className="flex gap-8 mb-4">
          <div className="text-center">
            <p className="font-display font-extrabold text-foreground">{userPosts.length}</p>
            <p className="text-xs text-muted-foreground">Drops</p>
          </div>
          <div className="text-center">
            <p className="font-display font-extrabold text-foreground">{counts?.followers || 0}</p>
            <p className="text-xs text-muted-foreground">Tides</p>
          </div>
          <div className="text-center">
            <p className="font-display font-extrabold text-foreground">{counts?.following || 0}</p>
            <p className="text-xs text-muted-foreground">Current</p>
          </div>
        </div>

        <button
          onClick={() => toggleFollow.mutate({ targetId: profile.user_id, isFollowing: !!isFollowing })}
          className={`px-8 py-2.5 rounded-2xl text-sm font-display font-extrabold transition-all ${
            isFollowing
              ? "bg-secondary text-foreground border border-border"
              : "gradient-brand text-primary-foreground shadow-glow"
          }`}
        >
          {isFollowing ? "Flowing" : "Flow"}
        </button>
      </div>

      {/* Posts grid */}
      <div className="px-3 max-w-[620px] mx-auto">
        {userPosts.map((post) => (
          <PostCard key={post.id} post={post} onOpen={() => setViewingPost(post)} />
        ))}
      </div>

      <AnimatePresence>
        {viewingPost && (
          <PostViewerModal post={viewingPost} onClose={() => setViewingPost(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserProfile;
