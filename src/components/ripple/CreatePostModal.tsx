import { useState, useRef, useCallback, useEffect } from "react";
import { X, Image, Loader2, Video, Mic, Hash, AtSign, Plus, Circle, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreatePost } from "@/hooks/usePosts";
import { useSuggestedUsers } from "@/hooks/useFollows";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UploadProgress from "./UploadProgress";

interface Props {
  open: boolean;
  onClose: () => void;
}

const TRENDING_HASHTAGS = [
  "#DigitalArt", "#NightVibes", "#CodeLife", "#Wanderlust",
  "#Photography", "#Music", "#Travel", "#Fitness",
  "#FoodPorn", "#OOTD", "#Motivation", "#Gaming",
  "#Ripple", "#Trending", "#Viral", "#Creative",
];

type MediaFile = {
  file: File;
  preview: string;
  type: "image" | "video" | "audio";
};

const CreatePostModal = ({ open, onClose }: Props) => {
  const [caption, setCaption] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [showHashtags, setShowHashtags] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [hashtagSearch, setHashtagSearch] = useState("");
  const [mentionSearch, setMentionSearch] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createPost = useCreatePost();

  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice-recording-${Date.now()}.webm`, { type: "audio/webm" });
        const previewUrl = URL.createObjectURL(audioFile);
        
        setMediaFiles((prev) => [...prev, { file: audioFile, preview: previewUrl, type: "audio" }].slice(0, 10));
        setIsRecordingMode(false);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error("Microphone permission denied or not supported");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
      const stream = mediaRecorderRef.current.stream;
      if (stream) stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecordingMode(false);
  };

  // Fetch users for @ mentions
  const { data: mentionUsers } = useQuery({
    queryKey: ["mention-users", mentionSearch],
    queryFn: async () => {
      const search = mentionSearch.replace("@", "").trim();
      const q = supabase.from("profiles").select("user_id, username, display_name, avatar_url");
      if (!search) {
        const { data } = await q.limit(6);
        return data || [];
      } else {
        const { data } = await q.ilike("username", `%${search}%`).limit(6);
        return data || [];
      }
    },
    enabled: showMentions,
  });

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newMedia: MediaFile[] = files.map((f) => {
      let type: "image" | "video" | "audio" = "image";
      if (f.type.startsWith("video/")) type = "video";
      else if (f.type.startsWith("audio/")) type = "audio";
      return { file: f, preview: URL.createObjectURL(f), type };
    });
    setMediaFiles((prev) => [...prev, ...newMedia].slice(0, 10));
    e.target.value = "";
  };

  const removeMedia = (idx: number) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setCaption((prev) => prev + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = caption.slice(0, start);
    const after = caption.slice(end);

    // Replace the current word being typed (e.g. @par → @partial_user)
    const lastWordMatch = before.match(/[@#]\w*$/);
    const wordStart = lastWordMatch ? start - lastWordMatch[0].length : start;
    const newCaption = caption.slice(0, wordStart) + text + " " + after;
    setCaption(newCaption);
    setTimeout(() => {
      ta.focus();
      const pos = wordStart + text.length + 1;
      ta.selectionStart = ta.selectionEnd = pos;
    }, 0);
  }, [caption]);

  const addHashtag = (tag: string) => {
    insertAtCursor(tag);
    setShowHashtags(false);
    setHashtagSearch("");
  };

  const addMention = (username: string) => {
    insertAtCursor(`@${username}`);
    setShowMentions(false);
    setMentionSearch("");
  };

  const filteredHashtags = hashtagSearch && hashtagSearch.length > 1
    ? TRENDING_HASHTAGS.filter((t) =>
        t.toLowerCase().includes(hashtagSearch.replace("#", "").toLowerCase())
      )
    : TRENDING_HASHTAGS;

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCaption(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const lastWord = textBefore.split(/\s/).pop() || "";

    if (lastWord.startsWith("#") && lastWord.length >= 1) {
      setHashtagSearch(lastWord);
      setShowHashtags(true);
      setShowMentions(false);
    } else if (lastWord.startsWith("@") && lastWord.length >= 1) {
      setMentionSearch(lastWord);
      setShowMentions(true);
      setShowHashtags(false);
    } else {
      setShowHashtags(false);
      setShowMentions(false);
    }
  };

  const handleSubmit = async () => {
    if (mediaFiles.length === 0 && !caption.trim()) return toast.error("Add media or write something");
    try {
      const mainFile = mediaFiles[0];
      setUploadPct(0);
      await createPost.mutateAsync({
        caption,
        imageFile: mainFile?.file || null,
        mediaType: mainFile?.type || "text",
        additionalFiles: mediaFiles.slice(1).map((m) => m.file),
        onProgress: (p) => setUploadPct(p),
      });
      toast.success("Drop streamed!");
      setUploadPct(0);
      setCaption("");
      mediaFiles.forEach((m) => URL.revokeObjectURL(m.preview));
      setMediaFiles([]);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to stream drop");
    }
  };

  const resetAndClose = () => {
    setCaption("");
    mediaFiles.forEach((m) => URL.revokeObjectURL(m.preview));
    setMediaFiles([]);
    setShowHashtags(false);
    setShowMentions(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-background/50 backdrop-blur-[24px]"
          onClick={resetAndClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card/75 rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-elevated w-full max-w-lg max-h-[90vh] overflow-y-auto backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10 rounded-t-3xl">
              <h2 className="font-display font-extrabold text-lg text-foreground">Drop in the Stream</h2>
              <button onClick={resetAndClose} className="p-2 rounded-xl hover:bg-secondary transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Media previews */}
            <div className="p-5 pb-0">
              {isRecordingMode ? (
                <div id="live-voice-recorder-panel" className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 flex flex-col items-center justify-center gap-4 mb-4 relative overflow-hidden backdrop-blur-md">
                  <div className="absolute top-0.5 inset-x-2 h-[20%] rounded-b-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                  
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-muted-foreground"}`} />
                    <p className="text-xs font-mono font-bold text-foreground">
                      {isRecording ? `Recording Audio Waves: ${formatTime(recordingDuration)}` : "Voice Recorder Ready"}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {!isRecording ? (
                      <button
                        id="btn-voice-record-start"
                        onClick={startRecording}
                        type="button"
                        className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all shadow-md animate-pulse"
                        title="Start Recording"
                      >
                        <Circle className="w-6 h-6 fill-current" />
                      </button>
                    ) : (
                      <button
                        id="btn-voice-record-stop"
                        onClick={stopRecording}
                        type="button"
                        className="w-12 h-12 rounded-full bg-foreground hover:bg-foreground/80 flex items-center justify-center text-background transition-all shadow-md"
                        title="Stop and Save"
                      >
                        <Square className="w-5 h-5 fill-current" />
                      </button>
                    )}

                    <button
                      id="btn-voice-record-cancel"
                      onClick={cancelRecording}
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground font-semibold px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {mediaFiles.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar mb-3">
                      {mediaFiles.map((m, i) => (
                        <div key={i} className="relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border border-border">
                          {m.type === "image" && <img src={m.preview} alt="" className="w-full h-full object-cover" />}
                          {m.type === "video" && (
                            <div className="w-full h-full bg-secondary flex items-center justify-center">
                              <Video className="w-8 h-8 text-primary" />
                              <video src={m.preview} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                            </div>
                          )}
                          {m.type === "audio" && (
                            <div className="w-full h-full bg-secondary flex items-center justify-center">
                              <Mic className="w-8 h-8 text-accent" />
                            </div>
                          )}
                          <button onClick={() => removeMedia(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {mediaFiles.length < 10 && (
                        <button onClick={() => fileRef.current?.click()} className="flex-shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center hover:border-primary/50 transition-colors">
                          <Plus className="w-6 h-6 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  )}

                  {mediaFiles.length === 0 && (
                    <div className="space-y-3 mb-4">
                      <button onClick={() => fileRef.current?.click()} className="w-full aspect-video rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 hover:border-primary/50 bg-secondary/15 transition-colors">
                        <div className="flex gap-3">
                          <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center">
                            <Image className="w-6 h-6 text-primary-foreground" />
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center">
                            <Video className="w-6 h-6 text-accent" />
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                            <Mic className="w-6 h-6 text-foreground" />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">Add photos, videos, or audio</p>
                      </button>

                      <button
                        id="btn-open-voice-recorder"
                        onClick={() => setIsRecordingMode(true)}
                        type="button"
                        className="w-full py-3 px-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 font-display font-extrabold text-xs flex items-center justify-center gap-2.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                      >
                        <Mic className="w-4.5 h-4.5 animate-pulse text-emerald-400" />
                        Record Live Audio Memo
                      </button>
                    </div>
                  )}
                </>
              )}

              <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={handleFiles} />
            </div>

            {/* Caption with hashtag/mention support */}
            <div className="px-5 relative">
              <textarea
                ref={textareaRef}
                value={caption}
                onChange={handleCaptionChange}
                placeholder="Drop your thoughts... use # for lagoons, @ for crew members"
                rows={3}
                className="w-full bg-secondary rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:ring-2 focus:ring-primary transition-all"
              />

              {/* Hashtag suggestions */}
              <AnimatePresence>
                {showHashtags && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute left-5 right-5 top-full mt-1 bg-card border border-border rounded-2xl shadow-elevated max-h-40 overflow-y-auto z-20"
                  >
                    {filteredHashtags.map((tag) => (
                      <button key={tag} onClick={() => addHashtag(tag)} className="w-full text-left px-4 py-2.5 text-sm text-primary font-semibold hover:bg-secondary/80 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                        {tag}
                      </button>
                    ))}
                    {filteredHashtags.length === 0 && (
                      <p className="px-4 py-3 text-xs text-muted-foreground">No matching hashtags</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mention suggestions */}
              <AnimatePresence>
                {showMentions && mentionUsers && mentionUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute left-5 right-5 top-full mt-1 bg-card border border-border rounded-2xl shadow-elevated max-h-48 overflow-y-auto z-20"
                  >
                    {mentionUsers.map((u: any) => (
                      <button
                        key={u.user_id}
                        onClick={() => addMention(u.username)}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/80 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                      >
                        <img src={u.avatar_url || ""} alt="" className="w-8 h-8 rounded-full bg-secondary" />
                        <div>
                          <p className="text-sm font-display font-bold text-foreground">@{u.username}</p>
                          <p className="text-xs text-muted-foreground">{u.display_name}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick actions bar */}
            <div className="flex items-center gap-2 px-5 py-3">
              <button onClick={() => { setShowHashtags(!showHashtags); setShowMentions(false); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-sm font-display font-bold text-foreground transition-colors">
                <Hash className="w-4 h-4 text-primary" /> Hashtag
              </button>
              <button onClick={() => { insertAtCursor("@"); setShowMentions(true); setShowHashtags(false); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-sm font-display font-bold text-foreground transition-colors">
                <AtSign className="w-4 h-4 text-accent" /> Mention
              </button>
            </div>

            {/* Trending hashtags */}
            <div className="px-5 pb-3">
              <p className="text-xs text-muted-foreground font-display font-bold mb-2">Trending</p>
              <div className="flex flex-wrap gap-1.5">
                {TRENDING_HASHTAGS.slice(0, 8).map((tag) => (
                  <button key={tag} onClick={() => addHashtag(tag)} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="px-5 pb-5 space-y-3">
              {createPost.isPending && (
                <UploadProgress value={uploadPct} label={`Streaming your drop ${mediaFiles.length > 1 ? `(${mediaFiles.length} files)` : ""}`} />
              )}
              <button
                onClick={handleSubmit}
                disabled={createPost.isPending || (mediaFiles.length === 0 && !caption.trim())}
                className="w-full py-3.5 rounded-2xl gradient-brand text-primary-foreground font-display font-extrabold shadow-glow disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {createPost.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> {Math.round(uploadPct)}%</> : "Drop in Stream"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreatePostModal;
