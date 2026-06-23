import { useState } from "react";
import { useConversations, useChatMessages, useSendMessage } from "@/hooks/useMessages";
import { useTypingIndicator, useMarkRead } from "@/hooks/useTyping";
import { useProfiles } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { Send, ArrowLeft, Search, MessageSquarePlus, Loader2, Check, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useRef } from "react";

const Messages = () => {
  const { user } = useAuth();
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: conversations, isLoading } = useConversations();
  const { data: profiles } = useProfiles();
  const { data: chatMessages } = useChatMessages(selectedPartner || "");
  const sendMessage = useSendMessage();
  const [msgText, setMsgText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { partnerTyping, sendTyping } = useTypingIndicator(selectedPartner);
  useMarkRead(selectedPartner);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, partnerTyping]);

  const handleSend = () => {
    if (!msgText.trim() || !selectedPartner) return;
    sendMessage.mutate({ receiverId: selectedPartner, content: msgText.trim() });
    setMsgText("");
  };

  const handleTypingChange = (v: string) => {
    setMsgText(v);
    if (v.trim()) sendTyping();
  };

  const selectedProfile = profiles?.find((p) => p.user_id === selectedPartner);

  // New chat user selection
  const availableUsers = profiles?.filter(
    (p) => p.user_id !== user?.id && p.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedPartner) {
    return (
      <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen max-w-[700px] mx-auto">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSelectedPartner(null)} className="p-2 rounded-xl hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <img src={selectedProfile?.avatar_url || ""} className="w-9 h-9 rounded-xl bg-secondary" />
          <div>
            <p className="text-sm font-display font-bold text-foreground">{selectedProfile?.username || "User"}</p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {chatMessages?.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMine
                    ? "gradient-brand text-primary-foreground rounded-br-lg"
                    : "bg-card border border-border text-foreground rounded-bl-lg"
                }`}>
                  <p>{msg.content}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : ""}`}>
                    <p className={`text-[10px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </p>
                    {isMine && (
                      msg.is_read
                        ? <CheckCheck className="w-3 h-3 text-primary-foreground" />
                        : <Check className="w-3 h-3 text-primary-foreground/70" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {partnerTyping && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-lg px-4 py-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border bg-card">
          <div className="flex gap-2">
            <input
              value={msgText}
              onChange={(e) => handleTypingChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message..."
              className="flex-1 bg-secondary rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!msgText.trim()}
              className="p-3 rounded-2xl gradient-brand text-primary-foreground shadow-glow disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto px-3 pt-4 lg:pt-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display font-extrabold text-2xl text-foreground">Messages</h1>
        <button
          onClick={() => setShowNewChat(!showNewChat)}
          className="p-2.5 rounded-xl gradient-brand text-primary-foreground shadow-glow"
        >
          <MessageSquarePlus className="w-5 h-5" />
        </button>
      </div>

      {/* New chat search */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people..."
                className="w-full pl-10 pr-4 py-3 bg-secondary rounded-2xl text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
            <div className="bg-card rounded-2xl border border-border p-2 max-h-48 overflow-y-auto">
              {availableUsers?.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => { setSelectedPartner(u.user_id); setShowNewChat(false); setSearchQuery(""); }}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-secondary transition-colors"
                >
                  <img src={u.avatar_url || ""} className="w-9 h-9 rounded-xl bg-secondary" />
                  <div className="text-left">
                    <p className="text-sm font-display font-bold text-foreground">{u.username}</p>
                    <p className="text-xs text-muted-foreground">{u.display_name}</p>
                  </div>
                </button>
              ))}
              {!availableUsers?.length && (
                <p className="text-center text-sm text-muted-foreground py-4">No users found</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : conversations?.length ? (
        <div className="space-y-2">
          {conversations.map((conv: any) => (
            <button
              key={conv.partnerId}
              onClick={() => setSelectedPartner(conv.partnerId)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-card border border-border hover:bg-secondary transition-colors"
            >
              <img src={conv.profile?.avatar_url || ""} className="w-12 h-12 rounded-xl bg-secondary" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-display font-bold text-foreground flex items-center gap-2">
                  {conv.profile?.username || "User"}
                  {conv.unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />}
                </p>
                <p className={`text-xs truncate ${conv.unreadCount > 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  {conv.lastMessage?.content}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(conv.lastMessage?.created_at), { addSuffix: false })}
                </span>
                {conv.unreadCount > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center shadow-glow">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="font-display font-bold text-xl text-foreground mb-2">No messages yet</p>
          <p className="text-sm text-muted-foreground">Start a conversation!</p>
        </div>
      )}
    </div>
  );
};

export default Messages;
