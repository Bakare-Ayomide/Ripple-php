import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePosts, type PostWithProfile } from "@/hooks/usePosts";
import PostCard from "@/components/ripple/PostCard";
import PostViewerModal from "@/components/ripple/PostViewerModal";
import { ChevronLeft, Hash } from "lucide-react";
import { AnimatePresence } from "framer-motion";

const HashtagPage = () => {
  const { tag } = useParams<{ tag: string }>();
  const navigate = useNavigate();
  const { data: allPosts, isLoading } = usePosts();
  const [viewingPost, setViewingPost] = useState<PostWithProfile | null>(null);

  const filteredPosts = allPosts?.filter((p) =>
    p.caption?.toLowerCase().includes(`#${tag?.toLowerCase()}`)
  ) || [];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Hash className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-foreground text-lg">#{tag}</h1>
            <p className="text-xs text-muted-foreground">{filteredPosts.length} posts</p>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="px-3 py-4 max-w-[620px] mx-auto">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-10">Loading...</p>
        ) : filteredPosts.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">No posts with #{tag}</p>
        ) : (
          filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} onOpen={() => setViewingPost(post)} />
          ))
        )}
      </div>

      <AnimatePresence>
        {viewingPost && (
          <PostViewerModal post={viewingPost} onClose={() => setViewingPost(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default HashtagPage;
