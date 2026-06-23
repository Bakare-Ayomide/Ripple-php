import { Settings, Grid3X3, Bookmark, Flame, LogOut, Loader2, Camera, Upload } from "lucide-react";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useFollowCounts } from "@/hooks/useFollows";
import { usePosts } from "@/hooks/usePosts";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import VerifiedBadge from "@/components/ripple/VerifiedBadge";
import RichCaption from "@/components/ripple/RichCaption";
import { toast } from "sonner";

const PRESET_AVATARS = [
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Liam&backgroundType=gradientLinear&backgroundRotation=120&backgroundColor=0d9488,0ea5e9",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Oliver&backgroundType=gradientLinear&backgroundRotation=180&backgroundColor=0284c7,f43f5e",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Jack&backgroundType=gradientLinear&backgroundRotation=45&backgroundColor=10b981,0d5c56",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Sasha&backgroundType=gradientLinear&backgroundRotation=120&backgroundColor=ec4899,8b5cf6",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Ruby&backgroundType=gradientLinear&backgroundRotation=60&backgroundColor=f43f5e,eab308",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Zoe&backgroundType=gradientLinear&backgroundRotation=240&backgroundColor=a855f7,3b82f6",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Alex&backgroundType=gradientLinear&backgroundRotation=120&backgroundColor=6366f1,e0f2fe",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Kai&backgroundType=gradientLinear&backgroundRotation=90&backgroundColor=22c55e,facc15",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Robin&backgroundType=gradientLinear&backgroundRotation=150&backgroundColor=f97316,e11d48",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Nala&backgroundType=gradientLinear&backgroundColor=ec4899,f43f5e",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Leo&backgroundType=gradientLinear&backgroundColor=10b981,8b5cf6",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Maya&backgroundType=gradientLinear&backgroundColor=f59e0b,ef4444"
];

const formatNumber = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
};

const Profile = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"posts" | "saved" | "waves">("posts");
  const { signOut, user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { data: counts } = useFollowCounts(user?.id || "");
  const { data: allPosts } = usePosts();

  const myPosts = allPosts?.filter((p) => p.user_id === user?.id) || [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateProfile = useUpdateProfile();
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;

      // Upload file to the 'posts' bucket
      const { error: uploadError } = await supabase.storage.from("posts").upload(path, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("posts").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      await updateProfile.mutateAsync({ avatarUrl: publicUrl });
      toast.success("Profile picture updated!");
      setShowAvatarEditor(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const selectPreset = async (url: string) => {
    try {
      await updateProfile.mutateAsync({ avatarUrl: url });
      toast.success("Avatar preset updated!");
      setShowAvatarEditor(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to select preset");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-3 pt-4 lg:pt-6">
      {/* Header */}
      <div className="bg-card rounded-3xl p-5 lg:p-8 border border-border shadow-card mb-4">
        <div className="flex items-start gap-5 lg:gap-10">
          <div 
            onClick={() => setShowAvatarEditor(!showAvatarEditor)}
            className="w-20 h-20 lg:w-28 lg:h-28 rounded-3xl p-[3px] gradient-brand shadow-glow flex-shrink-0 cursor-pointer relative overflow-hidden group"
            title="Choose or custom upload avatar"
          >
            <img src={profile?.avatar_url || ""} alt={profile?.username || ""} className="w-full h-full rounded-[21px] object-cover bg-[#000] transition-transform group-hover:scale-105 duration-300" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 select-none">
              <Camera className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              <span className="text-[10px] font-extrabold text-white tracking-widest">EDIT</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h2 className="text-xl lg:text-2xl font-display font-extrabold text-foreground flex items-center gap-2">{profile?.username || "user"}<VerifiedBadge verified={(profile as any)?.is_verified} size={18} /></h2>
              <button 
                onClick={() => navigate("/onboarding")}
                className="px-4 py-1.5 rounded-xl bg-secondary text-sm font-display font-bold text-foreground hover:bg-muted transition-colors"
                title="Review Sailor Alignment & Shape Stream"
              >
                Edit Shore
              </button>
              <button
                onClick={signOut}
                className="btn-liquid-glass-base btn-liquid-glass-secondary flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-display font-extrabold text-foreground active:scale-95 shadow-sm"
                title="Leave Crew"
              >
                <LogOut className="w-4 h-4 text-foreground/80 font-bold" />
                <span>Logout</span>
              </button>
            </div>
            <div className="flex gap-6 mb-3">
              {[
                { value: myPosts.length, label: "drops" },
                { value: counts?.followers || 0, label: "tides" },
                { value: counts?.following || 0, label: "current" },
              ].map(stat => (
                <div key={stat.label} className="text-center lg:text-left">
                  <p className="text-lg font-display font-extrabold text-foreground">{formatNumber(stat.value)}</p>
                  <p className="text-xs text-muted-foreground font-medium capitalize">{stat.label}</p>
                </div>
              ))}
            </div>
            {profile?.bio ? (
              <div className="hidden lg:block text-sm text-secondary-foreground leading-relaxed">
                <RichCaption text={profile.bio} />
              </div>
            ) : (
              <p className="hidden lg:block text-sm text-secondary-foreground leading-relaxed">No sea bio yet</p>
            )}
          </div>
        </div>
        {profile?.bio ? (
          <div className="lg:hidden text-sm text-secondary-foreground mt-3 leading-relaxed">
            <RichCaption text={profile.bio} />
          </div>
        ) : (
          <p className="lg:hidden text-sm text-secondary-foreground mt-3 leading-relaxed">No sea bio yet</p>
        )}

        <AnimatePresence>
          {showAvatarEditor && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 border-t border-border/30 pt-5 overflow-hidden"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-display font-extrabold text-foreground">Adjust Wave Avatar</h4>
                    <p className="text-xs text-muted-foreground font-medium">Select a 3D-styled emoji or upload a custom image</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-display font-bold text-xs hover:opacity-90 active:scale-95 transition-all shadow-sm"
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Upload Custom</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-2.5 overflow-x-auto py-2 px-1 hide-scrollbar -mx-5 px-5 lg:-mx-8 lg:px-8">
                  {PRESET_AVATARS.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => selectPreset(url)}
                      className="flex-shrink-0 w-14 h-14 rounded-2xl p-[1px] bg-border/25 hover:scale-105 active:scale-95 transition-all overflow-hidden relative group cursor-pointer bg-[#000]"
                    >
                      <img src={url} alt={`preset ${index}`} className="w-full h-full rounded-[14px] object-cover bg-[#000]" />
                      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs */}
      <div className="flex bg-card rounded-2xl border border-border p-1 mb-4">
        {[
          { key: "posts" as const, icon: Grid3X3, label: "Drops" },
          { key: "saved" as const, icon: Bookmark, label: "Anchored" },
          { key: "waves" as const, icon: Flame, label: "Splashes" },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-display font-bold text-sm transition-all
              ${tab === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-1.5 pb-20 lg:pb-8">
        {myPosts.length ? myPosts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative aspect-square group overflow-hidden rounded-2xl"
          >
            <img src={post.image_url || ""} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        )) : (
          <div className="col-span-3 text-center py-12">
            <p className="text-muted-foreground text-sm">No posts yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
