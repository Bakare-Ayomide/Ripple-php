import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { localSqlite } from "@/lib/sqliteLocal";

export interface PostWithProfile {
  id: string;
  user_id: string;
  caption: string | null;
  image_url: string | null;
  media_type: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified?: boolean | null;
  };
  is_liked?: boolean;
  is_saved?: boolean;
}

export const usePosts = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      let cachedPosts: PostWithProfile[] = [];
      try {
        cachedPosts = await localSqlite.getPosts();
      } catch (e) {
        console.warn("[LocalSQLite] Failed to load offline posts:", e);
      }

      try {
        const { data: posts, error } = await supabase
          .from("posts")
          .select("*, profiles!posts_user_id_profiles_fkey(username, display_name, avatar_url, is_verified)")
          .order("created_at", { ascending: false }) as any;
        if (error) throw error;

        let finalPosts: PostWithProfile[] = [];

        if (!user || !posts?.length) {
          finalPosts = (posts || []) as PostWithProfile[];
        } else {
          const postIds = posts.map((p: any) => p.id);
          const [{ data: likes }, { data: saved }] = await Promise.all([
            supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
            supabase.from("saved_posts").select("post_id").eq("user_id", user.id).in("post_id", postIds),
          ]);

          const likedSet = new Set(likes?.map((l: any) => l.post_id) || []);
          const savedSet = new Set(saved?.map((s: any) => s.post_id) || []);

          finalPosts = posts.map((p: any) => ({
            ...p,
            is_liked: likedSet.has(p.id),
            is_saved: savedSet.has(p.id),
          })) as PostWithProfile[];
        }

        // Cash fresh results immediately into SQLite-emulated IndexedDB on client device
        if (finalPosts.length > 0) {
          localSqlite.savePosts(finalPosts).catch((err) => {
            console.warn("[LocalSQLite] Async cache save failed:", err);
          });
        }

        return finalPosts;
      } catch (err) {
        console.warn("[LocalSQLite] Network down, serving local items", err);
        if (cachedPosts && cachedPosts.length > 0) {
          return cachedPosts;
        }
        throw err;
      }
    },
    // Seamless performance: load from local cache instantly on first hit while refetching is done in background
    placeholderData: [] as PostWithProfile[],
  });
};

export const usePost = (postId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["post", postId],
    queryFn: async () => {
      if (!postId) return null;
      const { data: post, error } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_profiles_fkey(username, display_name, avatar_url, is_verified)")
        .eq("id", postId)
        .maybeSingle() as any;
      if (error) throw error;
      if (!post) return null;

      if (!user) return post as PostWithProfile;

      const [{ data: likes }, { data: saved }] = await Promise.all([
        supabase.from("likes").select("post_id").eq("user_id", user.id).eq("post_id", postId),
        supabase.from("saved_posts").select("post_id").eq("user_id", user.id).eq("post_id", postId),
      ]);

      return {
        ...post,
        is_liked: !!likes?.length,
        is_saved: !!saved?.length,
      } as PostWithProfile;
    },
    enabled: !!postId,
  });
};

export const useCreatePost = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      caption,
      imageFile,
      mediaType = "image",
      additionalFiles = [],
      onProgress,
    }: {
      caption: string;
      imageFile: File | null;
      mediaType?: string;
      additionalFiles?: File[];
      onProgress?: (pct: number) => void;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const allFiles = imageFile ? [imageFile, ...additionalFiles] : additionalFiles;
      const urls: string[] = [];

      const total = Math.max(allFiles.length, 1);
      onProgress?.(1);

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        // simulated mid-file progress while waiting
        const baseStart = (i / total) * 95;
        const baseEnd = ((i + 0.9) / total) * 95;
        const timer = setInterval(() => {
          const next = baseStart + Math.random() * (baseEnd - baseStart);
          onProgress?.(Math.round(next));
        }, 180);
        const { error: uploadError } = await supabase.storage.from("posts").upload(path, file);
        clearInterval(timer);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("posts").getPublicUrl(path);
        urls.push(data.publicUrl);
        onProgress?.(Math.round(((i + 1) / total) * 95));
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        caption,
        image_url: urls.length > 0 ? urls.join(",") : null,
        media_type: mediaType,
      });
      if (error) throw error;
      onProgress?.(100);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
};

export const useToggleLike = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      if (isLiked) {
        await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
      } else {
        await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
      }
    },
    onMutate: async ({ postId, isLiked }) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const prev = qc.getQueryData(["posts"]);
      qc.setQueryData(["posts"], (old: PostWithProfile[] | undefined) =>
        old?.map((p) =>
          p.id === postId
            ? { ...p, is_liked: !isLiked, likes_count: p.likes_count + (isLiked ? -1 : 1) }
            : p
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["posts"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
};

export const useToggleSave = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ postId, isSaved }: { postId: string; isSaved: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      if (isSaved) {
        await supabase.from("saved_posts").delete().eq("user_id", user.id).eq("post_id", postId);
      } else {
        await supabase.from("saved_posts").insert({ user_id: user.id, post_id: postId });
      }
    },
    onMutate: async ({ postId, isSaved }) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const prev = qc.getQueryData(["posts"]);
      qc.setQueryData(["posts"], (old: PostWithProfile[] | undefined) =>
        old?.map((p) => (p.id === postId ? { ...p, is_saved: !isSaved } : p))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["posts"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
};
