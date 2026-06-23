import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useComments = (postId: string) => {
  return useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("comments")
        .select("*, profiles!comments_user_id_profiles_fkey(username, avatar_url, is_verified)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true }) as any);
      if (error) throw error;
      return data || [];
    },
    enabled: !!postId,
  });
};

export const useAddComment = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("comments").insert({
        user_id: user.id,
        post_id: postId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_, { postId }) => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
};
