import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Realtime typing indicator + read receipts via Supabase Presence + Broadcast
 * Channel name is deterministic per pair so both peers join the same room.
 */
const pairChannel = (a: string, b: string) => {
  const [x, y] = [a, b].sort();
  return `dm:${x}:${y}`;
};

export const useTypingIndicator = (partnerId: string | null) => {
  const { user } = useAuth();
  const [partnerTyping, setPartnerTyping] = useState(false);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !partnerId) return;
    const ch = supabase.channel(pairChannel(user.id, partnerId), {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "typing" }, (payload: any) => {
      if (payload.payload?.from === partnerId) {
        setPartnerTyping(true);
        if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = window.setTimeout(() => setPartnerTyping(false), 2500);
      }
    });
    ch.subscribe();
    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    };
  }, [user, partnerId]);

  const sendTyping = useCallback(() => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { from: user.id, at: Date.now() },
    });
  }, [user]);

  return { partnerTyping, sendTyping };
};

/** Mark all messages from partner -> me as read */
export const useMarkRead = (partnerId: string | null) => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user || !partnerId) return;
    supabase
      .from("messages")
      .update({ is_read: true })
      .eq("sender_id", partnerId)
      .eq("receiver_id", user.id)
      .eq("is_read", false)
      .then(() => {});
  }, [user, partnerId]);
};
