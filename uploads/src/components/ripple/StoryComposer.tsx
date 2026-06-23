import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Image as ImageIcon, Video, Music, Type, Loader2, Hash, AtSign, Circle, Square, Mic } from "lucide-react";
import { useCreateStory } from "@/hooks/useStories";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UploadProgress from "./UploadProgress";

interface Props {
  open: boolean;
  onClose: () => void;
}

const GRADIENT_PRESETS = [
  { id: "purple-blue", classes: "from-purple-600 via-pink-600 to-blue-600", label: "Ethereal" },
  { id: "cyan-indigo", classes: "from-cyan-500 via-blue-600 to-indigo-600", label: "Oceanic" },
  { id: "orange-pink", classes: "from-orange-500 via-red-500 to-pink-500", label: "Sunset" },
  { id: "emerald-cyan", classes: "from-emerald-500 via-teal-600 to-cyan-600", label: "Forest" },
  { id: "cosmic", classes: "from-zinc-900 via-neutral-800 to-slate-900", label: "Cosmic" },
];

const StoryComposer = ({ open, onClose }: Props) => {
  const [mediaType, setMediaType] = useState<"image" | "video" | "audio" | "text">("image");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [textBg, setTextBg] = useState(GRADIENT_PRESETS[0].classes);
  const [caption, setCaption] = useState("");
  const [pct, setPct] = useState(0);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [showHashtags, setShowHashtags] = useState(false);
  const [hashtagSearch, setHashtagSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const createStory = useCreateStory();

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
        const audioFile = new File([audioBlob], `story-recording-${Date.now()}.webm`, { type: "audio/webm" });
        const previewUrl = URL.createObjectURL(audioFile);
        
        setFile(audioFile);
        setPreview(previewUrl);

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

  const TRENDING_HASHTAGS = [
    "#DigitalArt", "#NightVibes", "#CodeLife", "#Wanderlust",
    "#Photography", "#Music", "#Travel", "#Fitness",
    "#FoodPorn", "#OOTD", "#Motivation", "#Gaming",
    "#Ripple", "#Trending", "#Viral", "#Creative",
  ];

  const filteredHashtags = hashtagSearch && hashtagSearch.length > 1
    ? TRENDING_HASHTAGS.filter((t) =>
        t.toLowerCase().includes(hashtagSearch.replace("#", "").toLowerCase())
      )
    : TRENDING_HASHTAGS;

  const { data: mentionUsers } = useQuery({
    queryKey: ["mention-users-story", mentionSearch],
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

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview("");
      setCaption("");
      setPct(0);
      setMediaType("image");
      setTextBg(GRADIENT_PRESETS[0].classes);
    }
  }, [open]);

  // Clean up object URLs when tabs or files change to avoid memory leaks
  useEffect(() => {
    if (preview && !preview.startsWith("data:") && !preview.startsWith("http")) {
      URL.revokeObjectURL(preview);
      setPreview("");
    }
    setFile(null);
  }, [mediaType]);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const insertText = (text: string) => {
    const ta = taRef.current;
    if (!ta) { setCaption((c) => c + text); return; }
    const start = ta.selectionStart;
    const before = caption.slice(0, start);
    const after = caption.slice(ta.selectionEnd);
    const lastWord = before.match(/[@#]\w*$/);
    const wordStart = lastWord ? start - lastWord[0].length : start;
    setCaption(caption.slice(0, wordStart) + text + " " + after);
  };

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setCaption(v);
    const cursor = e.target.selectionStart;
    const lastWord = v.slice(0, cursor).split(/\s/).pop() || "";
    if (lastWord.startsWith("@") && lastWord.length >= 1) {
      setMentionSearch(lastWord);
      setShowMentions(true);
      setShowHashtags(false);
    } else if (lastWord.startsWith("#") && lastWord.length >= 1) {
      setHashtagSearch(lastWord);
      setShowHashtags(true);
      setShowMentions(false);
    } else {
      setShowMentions(false);
      setShowHashtags(false);
    }
  };

  const submit = async () => {
    if (mediaType !== "text" && !file) {
      return toast.error(`Please select a ${mediaType} file first`);
    }
    if (mediaType === "text" && !caption.trim()) {
      return toast.error("Please enter text for your text story");
    }

    try {
      await createStory.mutateAsync({
        mediaFile: file,
        mediaType,
        thumbnailUrl: mediaType === "text" ? textBg : undefined,
        caption: caption.trim() || undefined,
        onProgress: setPct,
      });
      toast.success("Wave added!");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  if (!open) return null;

  const node = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/50 backdrop-blur-[24px] flex items-end sm:items-center justify-center p-4"
        style={{ zIndex: 99999 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border w-full max-w-md rounded-3xl shadow-elevated overflow-hidden backdrop-blur-xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="font-display font-extrabold text-lg text-foreground">New Wave Story</h2>
              <p className="text-xs text-muted-foreground">Share moments with your community</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto shrink pb-6">
            {/* Format Picker */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-secondary rounded-2xl shrink-0">
              <button
                onClick={() => setMediaType("image")}
                className={`py-2 px-1 rounded-xl text-xs font-display font-extrabold flex flex-col items-center gap-1.5 transition-all ${mediaType === "image" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <ImageIcon className="w-4 h-4 text-blue-500" />
                Image
              </button>
              <button
                onClick={() => setMediaType("video")}
                className={`py-2 px-1 rounded-xl text-xs font-display font-extrabold flex flex-col items-center gap-1.5 transition-all ${mediaType === "video" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Video className="w-4 h-4 text-purple-500" />
                Video
              </button>
              <button
                onClick={() => setMediaType("audio")}
                className={`py-2 px-1 rounded-xl text-xs font-display font-extrabold flex flex-col items-center gap-1.5 transition-all ${mediaType === "audio" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Music className="w-4 h-4 text-emerald-500" />
                Audio
              </button>
              <button
                onClick={() => setMediaType("text")}
                className={`py-2 px-1 rounded-xl text-xs font-display font-extrabold flex flex-col items-center gap-1.5 transition-all ${mediaType === "text" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Type className="w-4 h-4 text-amber-500" />
                Text
              </button>
            </div>

            {/* Media Canvas Stage */}
            {mediaType !== "text" ? (
              !preview ? (
                <div className="space-y-3">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 hover:border-primary/50 bg-secondary/30 transition-colors"
                  >
                    <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center shadow-sm">
                      {mediaType === "image" && <ImageIcon className="w-7 h-7 text-primary-foreground" />}
                      {mediaType === "video" && <Video className="w-7 h-7 text-primary-foreground" />}
                      {mediaType === "audio" && <Music className="w-7 h-7 text-primary-foreground" />}
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-foreground font-display font-extrabold">Upload a {mediaType}</p>
                      <p className="text-xs text-muted-foreground mt-1">Tap/Click to select from your device</p>
                    </div>
                  </button>

                  {mediaType === "audio" && (
                    <div className="border border-emerald-500/20 bg-emerald-950/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-3">
                      {isRecording ? (
                        <div className="flex flex-col items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                          <p className="text-xs font-mono font-bold text-foreground">
                            Recording Audio Waves: {formatTime(recordingDuration)}
                          </p>
                          <button
                            id="btn-story-record-stop"
                            onClick={stopRecording}
                            type="button"
                            className="bg-foreground text-background font-display font-black text-xs px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-foreground/80 mt-1 shadow-glow"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" /> Stop and Save Audio
                          </button>
                        </div>
                      ) : (
                        <button
                          id="btn-story-record-start"
                          onClick={startRecording}
                          type="button"
                          className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-display font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-glow"
                        >
                          <Mic className="w-4 h-4 text-white animate-pulse" />
                          Record Live Audio Memo
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-neutral-950 flex items-center justify-center border border-white/5 shadow-inner">
                  {mediaType === "image" && (
                    <img src={preview} alt="Upload content" className="w-full h-full object-cover" />
                  )}

                  {mediaType === "video" && (
                    <video src={preview} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                  )}

                  {mediaType === "audio" && (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-neutral-900 flex flex-col items-center justify-center p-6 gap-4 text-center">
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-2 shadow-glow"
                      >
                        <Music className="w-8 h-8" />
                      </motion.div>
                      <p className="text-xs text-secondary-foreground font-mono truncate max-w-[200px]" title={file?.name}>
                        {file?.name}
                      </p>
                      <audio src={preview} controls className="max-w-full scale-90 opacity-80" />
                    </div>
                  )}

                  <button
                    onClick={() => { setFile(null); setPreview(""); }}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition-colors z-10 border border-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {caption && (
                    <div className="absolute bottom-3 inset-x-3 bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2">
                      <p className="text-white text-sm font-display font-bold drop-shadow">{caption}</p>
                    </div>
                  )}
                </div>
              )
            ) : (
              /* Text Story Preview Canvas */
              <div className="relative">
                <div className={`w-full aspect-[3/4] rounded-2xl bg-gradient-to-tr ${textBg} flex flex-col items-center justify-center p-6 text-center shadow-lg select-none border border-white/5`}>
                  <p className="text-white text-xl sm:text-2xl font-display font-extrabold leading-snug drop-shadow-md break-words max-w-full">
                    {caption.trim() || "Type below to see preview..."}
                  </p>
                </div>
                {/* Presets Picker */}
                <div className="mt-3 flex gap-2 items-center justify-center py-2 bg-secondary/50 rounded-2xl">
                  {GRADIENT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setTextBg(p.classes)}
                      className={`w-8 h-8 rounded-full bg-gradient-to-tr ${p.classes} border-2 ${textBg === p.classes ? "border-foreground scale-110" : "border-transparent"} transition-all`}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic File Inputs */}
            <input
              ref={fileRef}
              type="file"
              accept={
                mediaType === "image" ? "image/*" :
                mediaType === "video" ? "video/*" :
                mediaType === "audio" ? "audio/*" :
                "*"
              }
              className="hidden"
              onChange={pickFile}
            />

            {/* Caption Textarea */}
            <div className="relative">
              <textarea
                ref={taRef}
                value={caption}
                onChange={handleCaptionChange}
                placeholder={mediaType === "text" ? "Type your text story..." : "Add text, #hashtags or @mentions..."}
                rows={mediaType === "text" ? 3 : 2}
                maxLength={mediaType === "text" ? 200 : 500}
                className="w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground text-foreground"
              />
              {mediaType === "text" && (
                <span className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground font-mono">
                  {caption.length}/200
                </span>
              )}
              <AnimatePresence>
                {showMentions && mentionUsers && mentionUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-2xl shadow-elevated max-h-48 overflow-y-auto z-20 animate-fade-in"
                  >
                    {mentionUsers.map((u: any) => (
                      <button key={u.user_id} onClick={() => { insertText(`@${u.username}`); setShowMentions(false); }}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/80">
                        <img src={u.avatar_url || ""} className="w-8 h-8 rounded-full bg-secondary" />
                        <div>
                          <p className="text-sm font-display font-bold text-foreground">@{u.username}</p>
                          <p className="text-xs text-muted-foreground">{u.display_name}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showHashtags && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-2xl shadow-elevated max-h-40 overflow-y-auto z-20 animate-fade-in"
                  >
                    {filteredHashtags.map((tag) => (
                      <button key={tag} onClick={() => { insertText(tag); setShowHashtags(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-primary font-semibold hover:bg-secondary/80">
                        {tag}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action helpers */}
            <div className="flex gap-2">
              <button onClick={() => insertText("#")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-display font-bold transition-all">
                <Hash className="w-3.5 h-3.5 text-primary" /> Hashtag
              </button>
              <button onClick={() => insertText("@")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-display font-bold transition-all">
                <AtSign className="w-3.5 h-3.5 text-accent" /> Mention
              </button>
            </div>

            {createStory.isPending && <UploadProgress value={pct} label={`Streaming your ${mediaType}`} />}

            <button
              onClick={submit}
              disabled={(mediaType !== "text" && !file) || (mediaType === "text" && !caption.trim()) || createStory.isPending}
              className="w-full py-3.5 rounded-2xl gradient-brand text-primary-foreground font-display font-extrabold shadow-glow disabled:opacity-50 disabled:scale-100 active:scale-98 transition-all flex items-center justify-center gap-2 mt-2 shrink-0"
            >
              {createStory.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> {Math.round(pct)}%</> : "Share Wave"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(node, document.body);
};

export default StoryComposer;
