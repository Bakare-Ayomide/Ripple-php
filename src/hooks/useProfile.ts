import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useProfile = (userId?: string) => {
  const { user } = useAuth();
  const targetId = userId || user?.id;

  return useQuery({
    queryKey: ["profile", targetId],
    queryFn: async () => {
      if (!targetId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", targetId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!targetId,
  });
};

export const useProfiles = () => {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ avatarUrl, bio, username, hidePropagationDetails }: { avatarUrl?: string; bio?: string; username?: string; hidePropagationDetails?: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      const updates: any = {};
      if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
      if (bio !== undefined) updates.bio = bio;
      if (username !== undefined) updates.username = username;
      if (hidePropagationDetails !== undefined) updates.hide_propagation_details = hidePropagationDetails;

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
};
