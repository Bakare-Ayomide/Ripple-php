import { usePosts } from "@/hooks/usePosts";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useCachedUrl } from "@/lib/mediaCache";

const ExploreItem = ({ post, isLarge }: { post: any; isLarge: boolean }) => {
  const mediaUrls = post.image_url?.split(",").map((u: any) => u.trim()).filter(Boolean) || [];
  const primaryMediaUrl = mediaUrls[0] || "";
  const cachedUrl = useCachedUrl(primaryMediaUrl);

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`relative overflow-hidden rounded-2xl group ${isLarge ? "col-span-2 row-span-2" : ""}`}
    >
      {primaryMediaUrl ? (
        <img
          src={cachedUrl || primaryMediaUrl}
          alt=""
          className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full aspect-square bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center p-3 text-[10px] text-muted-foreground font-mono">
          <span className="line-clamp-4">{post.caption || "Text Ripple"}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.button>
  );
};

const Explore = () => {
  const { data: posts } = usePosts();
  const [search, setSearch] = useState("");

  const allPosts = posts || [];

  return (
    <div className="max-w-[900px] mx-auto px-3 pt-4 lg:pt-6">
      {/* Search */}
      <div className="mb-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dive into currents, crew, Lagoons..."
            className="w-full h-12 pl-12 pr-4 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground font-medium outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Tags */}
      <div className="flex gap-2 mb-5 overflow-x-auto hide-scrollbar">
        {["🌊 Making Waves", "📸 Photos", "🎥 Video", "🎵 Music", "🎨 Art", "✈️ Travel"].map(tag => (
          <button key={tag} className="px-4 py-2 rounded-2xl bg-card border border-border text-sm font-display font-semibold text-foreground whitespace-nowrap hover:bg-secondary transition-colors">
            {tag}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-1.5 pb-20 lg:pb-8">
        {allPosts.map((post, i) => {
          const isLarge = i % 5 === 0;
          return (
            <ExploreItem key={post.id} post={post} isLarge={isLarge} />
          );
        })}
        {!allPosts.length && (
          <div className="col-span-3 text-center py-12">
            <p className="text-muted-foreground text-sm">The ocean is calm, no Drops to explore yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;
