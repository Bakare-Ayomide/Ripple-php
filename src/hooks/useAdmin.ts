import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useIsAdmin = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });
};

export const useAllUsers = () => {
  return useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

export const useAllPosts = () => {
  return useQuery({
    queryKey: ["admin-all-posts"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("posts")
        .select("*, profiles!posts_user_id_profiles_fkey(username, display_name, avatar_url, is_verified)")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data || [];
    },
  });
};
