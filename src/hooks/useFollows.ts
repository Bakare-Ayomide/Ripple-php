import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useFollowStatus = (targetUserId: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["follow-status", targetUserId],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!targetUserId,
  });
};

export const useFollowCounts = (userId: string) => {
  return useQuery({
    queryKey: ["follow-counts", userId],
    queryFn: async () => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
      ]);
      return { followers: followers || 0, following: following || 0 };
    },
    enabled: !!userId,
  });
};

export const useToggleFollow = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ targetId, isFollowing }: { targetId: string; isFollowing: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
      } else {
        await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
      }
    },
    onSuccess: (_, { targetId }) => {
      qc.invalidateQueries({ queryKey: ["follow-status", targetId] });
      qc.invalidateQueries({ queryKey: ["follow-counts"] });
      qc.invalidateQueries({ queryKey: ["suggested-users"] });
    },
  });
};

export const useSuggestedUsers = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["suggested-users"],
    queryFn: async () => {
      if (!user) return [];
      // Get users I'm not following
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = following?.map((f: any) => f.following_id) || [];
      followingIds.push(user.id); // exclude self

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .not("user_id", "in", `(${followingIds.join(",")})`)
        .limit(5);

      return data || [];
    },
    enabled: !!user,
  });
};
