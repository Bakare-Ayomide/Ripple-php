import { useState, useMemo } from "react";
import StoriesBar from "@/components/ripple/StoriesBar";
import PostCard from "@/components/ripple/PostCard";
import SuggestionsPanel from "@/components/ripple/SuggestionsPanel";
import SuggestedUsersGrid from "@/components/ripple/SuggestedUsersGrid";
import CreatePostModal from "@/components/ripple/CreatePostModal";
import PostViewerModal from "@/components/ripple/PostViewerModal";
import FeaturedCarousel from "@/components/ripple/FeaturedCarousel";
import { usePosts, type PostWithProfile } from "@/hooks/usePosts";
import { Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";

const Feed = () => {
  const { data: posts, isLoading } = usePosts();
  const [showCreate, setShowCreate] = useState(false);
  const [viewingPost, setViewingPost] = useState<PostWithProfile | null>(null);

  // Top 15 posts by engagement for carousel
  const featuredPosts = useMemo(() => {
    if (!posts?.length) return [];
    return [...posts]
      .sort((a, b) => ((b.likes_count || 0) + (b.comments_count || 0)) - ((a.likes_count || 0) + (a.comments_count || 0)))
      .slice(0, 15);
  }, [posts]);

  const renderFeedItems = () => {
    if (!posts?.length) return null;
    const items: React.ReactNode[] = [];
    posts.forEach((post, i) => {
      items.push(
        <PostCard key={post.id} post={post} featured={i === 0} onOpen={() => setViewingPost(post)} />
      );
      // Suggested users after first post
      if (i === 0) {
        items.push(<SuggestedUsersGrid key="suggestions-inline" />);
      }
      // Featured carousel after every 7 posts
      if ((i + 1) % 7 === 0 && featuredPosts.length > 0) {
        items.push(
          <FeaturedCarousel
            key={`carousel-${i}`}
            posts={featuredPosts}
            onPostClick={(p) => setViewingPost(p)}
          />
        );
      }
    });
    return items;
  };

  return (
    <>
      <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen">
        <StoriesBar />

        <div className="flex-1 min-w-0 overflow-y-auto hide-scrollbar">
          <div className="w-full max-w-[620px] mx-auto lg:mx-0 lg:max-w-none">
            <div className="px-3 lg:px-6 pt-2 lg:pt-4 pb-24 lg:pb-4">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : posts?.length ? (
                renderFeedItems()
              ) : (
                <div className="text-center py-16 px-4">
                  <p className="font-display font-extrabold text-2xl text-foreground mb-2">The Stream is Calm</p>
                  <p className="text-sm text-muted-foreground mb-6">Be the first to make a splash!</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="px-8 py-3.5 rounded-2xl gradient-brand text-primary-foreground font-display font-extrabold shadow-glow text-base"
                  >
                    Create a Drop
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <SuggestionsPanel />
      </div>

      <CreatePostModal open={showCreate} onClose={() => setShowCreate(false)} />

      <AnimatePresence>
        {viewingPost && (
          <PostViewerModal post={viewingPost} onClose={() => setViewingPost(null)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default Feed;
