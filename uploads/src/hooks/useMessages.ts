import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface MessageWithProfile {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export const useConversations = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      if (!user) return [];
      // Get all unique conversation partners
      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!messages?.length) return [];

      // Group by partner
      const partnerMap = new Map<string, any>();
      for (const msg of messages) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, msg);
        }
      }

      const partnerIds = Array.from(partnerMap.keys());
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", partnerIds);

      return partnerIds.map((pid) => ({
        partnerId: pid,
        lastMessage: partnerMap.get(pid),
        profile: profiles?.find((p: any) => p.user_id === pid),
        unreadCount: messages.filter((m: any) => m.sender_id === pid && !m.is_read).length,
      }));
    },
    enabled: !!user,
    refetchInterval: 3000,
  });
};

export const useChatMessages = (partnerId: string) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Realtime subscription
  useEffect(() => {
    if (!user || !partnerId) return;
    const channel = supabase
      .channel(`chat-${partnerId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        const msg = payload.new as any;
        if (
          (msg.sender_id === user.id && msg.receiver_id === partnerId) ||
          (msg.sender_id === partnerId && msg.receiver_id === user.id)
        ) {
          qc.invalidateQueries({ queryKey: ["chat", partnerId] });
          qc.invalidateQueries({ queryKey: ["conversations"] });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId, qc]);

  return useQuery({
    queryKey: ["chat", partnerId],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });
      return (data || []) as MessageWithProfile[];
    },
    enabled: !!user && !!partnerId,
    refetchInterval: 2500,
  });
};

export const useSendMessage = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ receiverId, content }: { receiverId: string; content: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_, { receiverId }) => {
      qc.invalidateQueries({ queryKey: ["chat", receiverId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};
