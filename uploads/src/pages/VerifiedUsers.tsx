import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import VerifiedBadge from "@/components/ripple/VerifiedBadge";

const VerifiedUsers = () => {
  const { data: users, isLoading } = useQuery({
    queryKey: ["verified-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_verified", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="max-w-[900px] mx-auto px-3 pt-4 lg:pt-6 pb-20 lg:pb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[#1d9bf0] flex items-center justify-center">
          <BadgeCheck className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-2xl text-foreground">Verified Users</h1>
          <p className="text-sm text-muted-foreground">{users?.length || 0} verified accounts</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : users && users.length > 0 ? (
        <div className="space-y-2">
          {users.map((u: any) => (
            <Link
              to={`/user/${u.username}`}
              key={u.id}
              className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 border border-border hover:bg-secondary/40 transition-colors"
            >
              <img src={u.avatar_url || ""} alt={u.username} className="w-12 h-12 rounded-xl bg-secondary object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-bold text-foreground truncate flex items-center gap-1">
                  {u.display_name || u.username}
                  <VerifiedBadge verified size={14} />
                </p>
                <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No verified users yet.</p>
      )}
    </div>
  );
};

export default VerifiedUsers;
