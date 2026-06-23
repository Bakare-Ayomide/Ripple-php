import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Waves, ArrowRight, ArrowLeft, Check, Compass, Users, 
  Radio, Image as ImageIcon, Flame, Sparkles, 
  Laptop, Music, Trophy, Gamepad2, Film, 
  Shirt, Briefcase, Camera, Palmtree, Utensils, Beaker, GraduationCap, 
  HeartPulse, Tv, Palette, Vote, Loader2, Bell, Globe, Sparkle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Stage =
  | "splash"
  | "slide1"
  | "slide2"
  | "slide3"
  | "auth_options"
  | "auth_email"
  | "step1_interests"
  | "step2_lagoons"
  | "step3_creators"
  | "step4_flow"
  | "step5_waters"
  | "step6_shore"
  | "step7_notifications"
  | "building_stream"
  | "welcome";

const INTERESTS = [
  { id: "travel", label: "Travel", icon: Palmtree, angle: 0, radius: 110 },
  { id: "movies", label: "Movies", icon: Film, angle: 45, radius: 110 },
  { id: "sports", label: "Sports", icon: Trophy, angle: 90, radius: 110 },
  { id: "music", label: "Music", icon: Music, angle: 135, radius: 110 },
  { id: "tech", label: "Tech", icon: Laptop, angle: 180, radius: 110 },
  { id: "art", label: "Art", icon: Palette, angle: 225, radius: 110 },
  { id: "gaming", label: "Gaming", icon: Gamepad2, angle: 270, radius: 110 },
  { id: "fashion", label: "Fashion", icon: Shirt, angle: 315, radius: 110 },

  { id: "business", label: "Business", icon: Briefcase, angle: 30, radius: 55 },
  { id: "science", label: "Science", icon: Beaker, angle: 120, radius: 55 },
  { id: "food", label: "Food", icon: Utensils, angle: 210, radius: 55 },
  { id: "health", label: "Health", icon: HeartPulse, angle: 300, radius: 55 },
];

const LAGOONS = [
  { id: "tech_lagoon", name: "Tech Lagoon", desc: "Where code, servers, and breakthroughs make waves.", icon: Laptop, members: "45K mariners" },
  { id: "music_lagoon", name: "Music Lagoon", desc: "Share deep cuts, vinyl, and synthesizer loops.", icon: Music, members: "38K mariners" },
  { id: "football_lagoon", name: "Football Lagoon", desc: "Gathering for matches, highlights, and game day.", icon: Trophy, members: "61K mariners" },
  { id: "movie_lagoon", name: "Movie Lagoon", desc: "Cinephiles reviewing indie films and classics.", icon: Film, members: "27K mariners" }
];

const SUGGESTED_CREATORS = [
  { id: "sarah_designs", name: "Sarah Chen", username: "sarah.designs", bio: "Visual designer crafting ripples.", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=sarah", followers: "12.4K" },
  { id: "wanderlust_mike", name: "Mike Torres", username: "wanderlust_mike", bio: "Sailing through open currents in search of epic shores.", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=mike", followers: "8.9K" },
  { id: "aria_patel", name: "Aria Patel", username: "aria.patel", bio: "Serene coastal architecture design.", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=aria", followers: "45K" }
];

const FLOW_OPTIONS = [
  { id: "posts", title: "Drops (Posts)", desc: "Text-centric quick ideas and reflections.", icon: Sparkles },
  { id: "stories", title: "Waves (Stories)", desc: "Temporary 24h photo or video flashes.", icon: Flame },
  { id: "live", title: "Live Currents", desc: "Real-time broadcasting flows instantly.", icon: Radio },
  { id: "discussions", title: "Discussions", desc: "Q&A channels and debates.", icon: Users }
];

const STREAM_MESSAGES = [
  "Creating Your Stream...",
  "Following the Current...",
  "Discovering New Waters...",
  "Preparing Your First Ripples..."
];

const Onboarding = () => {
  const { user, signUp, signIn, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("splash");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedLagoons, setSelectedLagoons] = useState<string[]>([]);
  const [followingCreators, setFollowingCreators] = useState<string[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [flowTypes, setFlowTypes] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("global");

  // Load real onboarding core creators or active profile fallbacks
  useEffect(() => {
    const fetchCoreCreators = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("is_onboarding_core", true);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const formatted = data.map((p: any) => ({
            id: p.id,
            user_id: p.user_id,
            name: p.display_name || p.username || "Real Sailor",
            username: p.username || "sailor",
            bio: p.bio || "Navigating the ocean of ripples",
            avatar: p.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${p.username}`,
            followers: Math.floor(Math.random() * 450 + 10)
          }));
          setCreators(formatted);
        } else {
          // Fallback to active profiles
          const { data: activeProfiles } = await supabase
            .from("profiles")
            .select("*")
            .limit(10);
            
          if (activeProfiles && activeProfiles.length > 0) {
            const formatted = activeProfiles.map((p: any) => ({
              id: p.id,
              user_id: p.user_id,
              name: p.display_name || p.username || "Real Sailor",
              username: p.username || "sailor",
              bio: p.bio || "Navigating the ocean of ripples",
              avatar: p.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${p.username}`,
              followers: Math.floor(Math.random() * 450 + 10)
            }));
            setCreators(formatted);
          } else {
            // Hard fallback if there are absolutely no profiles in DB
            setCreators(
              SUGGESTED_CREATORS.map((sc, ix) => ({
                id: sc.id + "_" + ix,
                user_id: "",
                name: sc.name,
                username: sc.username,
                bio: sc.bio,
                avatar: sc.avatar,
                followers: sc.followers
              }))
            );
          }
        }
      } catch (err) {
        console.error("Error fetching core creators:", err);
      }
    };
    fetchCoreCreators();
  }, []);

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [shoreUsername, setShoreUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("https://api.dicebear.com/9.x/fun-emoji/svg?seed=captain&backgroundType=gradientLinear");

  // Auth Form State
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Status simulation
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Synchronize base attributes if authenticated
  useEffect(() => {
    if (user) {
      if (user.user_metadata?.needs_onboarding !== true) {
        if (stage === "splash") {
          setStage("step6_shore");
        }
      } else {
        const introStages = ["splash", "slide1", "slide2", "slide3", "auth_options", "auth_email"];
        if (introStages.includes(stage)) {
          setStage("step1_interests");
        }
      }
      setDisplayName(user.user_metadata?.display_name || "");
      setShoreUsername(user.user_metadata?.username || "");
      if (user.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
      }
    }
  }, [user, stage]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (stage === "building_stream") {
      interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % STREAM_MESSAGES.length);
      }, 1600);
    }
    return () => clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (stage === "building_stream") {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setStage("welcome"), 600);
            return 100;
          }
          return prev + 5;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [stage]);

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingAuth) return;
    setSubmittingAuth(true);
    try {
      if (authMode === "signup") {
        if (!shoreUsername || shoreUsername.length < 3) {
          throw new Error("Username must be at least 3 digits/characters");
        }
        const { error } = await signUp(email, password, shoreUsername, "nonbinary");
        if (error) throw error;
        toast.success("Vessel claimed! Lets choose interests.");
        setStage("step1_interests");
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success("Welcome back to the Tide");
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "An auth error occurred.");
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleMockAuth = (provider: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: `Syncing ${provider} credentials...`,
        success: () => {
          setStage("step1_interests");
          setDisplayName("Stream Sailor");
          setShoreUsername(`mariner_${Math.floor(Math.random() * 8999 + 1000)}`);
          return `Authorized via ${provider}!`;
        },
        error: "Sync timed out"
      }
    );
  };

  const saveShoreProfile = async () => {
    if (!displayName) {
      toast.error("Please enter a display name!");
      return;
    }
    const cleanUser = shoreUsername.toLowerCase().trim() || `mariner_${Math.floor(Math.random() * 8999 + 1000)}`;
    if (user) {
      const { data: duplicate } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", cleanUser)
        .neq("user_id", user.id)
        .maybeSingle();

      if (duplicate) {
        toast.error("That username is taken by another explorer!");
        return;
      }

      await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          username: cleanUser,
          bio: bio || "Navigating the ocean of ripples",
          avatar_url: avatarUrl
        })
        .eq("user_id", user.id);
    }
    setStage("step7_notifications");
  };

  const handleFinishOnboarding = async () => {
    if (user) {
      // Actually apply follows to database for onboarding creators
      if (followingCreators.length > 0) {
        try {
          // Find matching selected creator profiles
          const toFollow = creators.filter(c => followingCreators.includes(c.username) && c.user_id && c.user_id !== user.id);
          for (const target of toFollow) {
            // Check if already followed to avoid duplicate key errors
            const { data: existing } = await supabase
              .from("follows")
              .select("id")
              .eq("follower_id", user.id)
              .eq("following_id", target.user_id)
              .maybeSingle();

            if (!existing) {
              await supabase.from("follows").insert({
                follower_id: user.id,
                following_id: target.user_id
              });
            }
          }
        } catch (e) {
          console.error("Failed to persist onboarding follows:", e);
        }
      }

      await supabase.auth.updateUser({
        data: { onboarding_completed: true, needs_onboarding: false }
      });

      await refreshUser();
    }
    navigate("/");
    toast.success("Welcome to Ripple! Directing to main stream.");
  };

  // Convert step to a indicator width percentage
  const steps = [
    "splash", "slide1", "slide2", "slide3", 
    "auth_options", "auth_email", 
    "step1_interests", "step2_lagoons", "step3_creators", 
    "step4_flow", "step5_waters", "step6_shore", "step7_notifications",
    "building_stream", "welcome"
  ];
  const activeIndex = steps.indexOf(stage);
  const percentComplete = Math.max(8, Math.round(((activeIndex + 1) / steps.length) * 100));

  // Circular placement mathematical calculation for interest nodes on concentric ripples
  const getInterestCoords = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    // Offset relative to center of the layout stage
    const x = Math.sin(rad) * radius;
    const y = -Math.cos(rad) * radius;
    return { x, y };
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-between items-center relative overflow-hidden text-white/90 p-4 font-sans select-none"
      style={{
        background: "radial-gradient(circle at 50% 30%, #031409 0%, #010603 100%)"
      }}
    >
      {/* High fidelity Unsplash organic dewy foliage blend layer */}
      <div 
        className="absolute inset-0 opacity-[0.22] bg-cover bg-center mix-blend-overlay pointer-events-none z-0"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=1200')"
        }}
      />

      {/* Radiant mint green organic ambient nodes */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[80vw] h-[80vh] bg-emerald-500/[0.12] rounded-full blur-[130px] pointer-events-none z-1" />
      <div className="absolute bottom-[10%] right-[10%] w-[50vw] h-[50vh] bg-teal-400/[0.08] rounded-full blur-[90px] pointer-events-none z-1" />

      {/* SVG Liquid fusion gooey filter matrix */}
      <svg className="absolute hidden">
        <defs>
          <filter id="liquid-blend">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Top Segment Line Bar aligned with the screenshot look */}
      <div className="w-full max-w-xl flex flex-col gap-3 py-3 relative z-10 font-sans">
        <div className="flex items-center justify-between w-full">
          <div className="flex-1 bg-white/10 h-[3px] rounded-full overflow-hidden mr-4">
            <div 
              className="bg-emerald-400 h-full transition-all duration-300" 
              style={{ width: `${percentComplete}%` }}
            />
          </div>
          {stage !== "building_stream" && stage !== "welcome" && (
            <button 
              onClick={() => setStage("step1_interests")}
              className="text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-white transition-all"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      {/* Primary Centered Responsive content stage wrapper */}
      <div className="flex-1 w-full max-w-xl flex flex-col justify-center items-center py-5 relative z-10 px-2 sm:px-6">
        <AnimatePresence mode="wait">
          
          {/* ================= STAGE 1: SPLASH ================= */}
          {stage === "splash" && (
            <motion.div
              key="splash"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[500px]"
            >
              <div className="pt-4 max-w-md">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Ripple Waters</span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1.5 font-sans leading-none">
                  A single Drop falls into water...
                </h1>
                <p className="text-sm text-neutral-300 font-sans tracking-wide leading-relaxed mt-2 p-1">
                  Ripple circles expand outward. Welcome to ocean currents.
                </p>
              </div>

              {/* Core Concentric Circles Radiator */}
              <div className="my-[40px] relative w-64 h-64 flex items-center justify-center">
                <div className="absolute w-64 h-64 border border-emerald-500/10 rounded-full animate-ping scale-110" />
                <div className="absolute w-44 h-44 border border-emerald-500/10 rounded-full animate-pulse" />
                <div className="absolute w-28 h-28 border border-white/5 rounded-full" />
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-[0_0_25px_rgba(52,211,153,0.3)] select-none">
                  <Waves className="w-8 h-8 animate-beat" />
                </div>
              </div>

              <div className="w-full max-w-sm px-4">
                <button
                  onClick={() => setStage("slide1")}
                  className="w-full h-12 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 font-bold uppercase tracking-wider text-xs shadow-[0_0_24px_rgba(16,185,129,0.35)] hover:shadow-emerald-500/50 transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  <span>Launch Ripple</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 2: INTRO SLIDE 1 ================= */}
          {stage === "slide1" && (
            <motion.div
              key="slide1"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[500px]"
            >
              <div className="pt-4 max-w-md">
                <h2 className="text-lg sm:text-xl font-medium tracking-wide text-neutral-200 font-sans leading-relaxed px-2">
                  A single Drop falls into water...<br/>
                  Ripple circles expand outward.
                </h2>
              </div>

              {/* Concentric rings to replicate exactly the screenshot layout */}
              <div className="relative w-64 h-64 my-6 flex items-center justify-center">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i}
                    className="absolute rounded-full border border-emerald-500/10"
                    style={{
                      width: `${i * 50}px`,
                      height: `${i * 50}px`,
                      opacity: 0.15 * (6 - i)
                    }}
                  />
                ))}
                <motion.div
                  animate={{ y: [-15, 0], opacity: [0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
                  className="w-5 h-6 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)] relative z-10"
                >
                  <Sparkles className="w-6 h-6" />
                </motion.div>
              </div>

              <div className="w-full max-w-sm px-4">
                <p className="text-xs text-neutral-400 leading-relaxed mb-6 px-1.5 font-sans">
                  Your voice and media launch waves that travel, crossing currents with mariners around the globe.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStage("splash")}
                    className="h-11 px-4 border border-white/10 rounded-full text-neutral-300 font-semibold text-xs hover:bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStage("slide2")}
                    className="flex-1 h-11 rounded-full border border-emerald-500/40 bg-emerald-950/45 text-emerald-300 font-bold uppercase text-xs tracking-wider hover:bg-emerald-900/60 transition-all flex items-center justify-center gap-1"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 3: INTRO SLIDE 2 ================= */}
          {stage === "slide2" && (
            <motion.div
              key="slide2"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[500px]"
            >
              <div className="pt-4 max-w-md">
                <h2 className="text-lg sm:text-xl font-medium tracking-wide text-neutral-200 font-sans leading-relaxed">
                  Join Beautiful Lagoons
                </h2>
              </div>

              <div className="relative w-64 h-64 my-6 flex items-center justify-center">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i}
                    className="absolute rounded-full border border-teal-500/10"
                    style={{
                      width: `${i * 50}px`,
                      height: `${i * 50}px`,
                      opacity: 0.15 * (6 - i)
                    }}
                  />
                ))}
                <div className="w-14 h-14 rounded-full bg-teal-500/15 border border-teal-400/45 flex items-center justify-center text-teal-300 shadow-lg relative z-10 animate-pulse">
                  <Compass className="w-7 h-7" />
                </div>
              </div>

              <div className="w-full max-w-sm px-4">
                <p className="text-xs text-neutral-400 leading-relaxed mb-6 px-1.5 font-sans">
                  Lagoons are safe harbors around code, design, books, synthesizers, vinyls, and sports.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStage("slide1")}
                    className="h-11 px-4 border border-white/10 rounded-full text-neutral-300 font-semibold text-xs hover:bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStage("slide3")}
                    className="flex-1 h-11 rounded-full border border-teal-500/40 bg-teal-950/45 text-teal-300 font-bold uppercase text-xs tracking-wider hover:bg-teal-900/60 transition-all flex items-center justify-center gap-1"
                  >
                    <span>Anchor Down</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 4: INTRO SLIDE 3 ================= */}
          {stage === "slide3" && (
            <motion.div
              key="slide3"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[500px]"
            >
              <div className="pt-4 max-w-md">
                <h2 className="text-lg sm:text-xl font-medium tracking-wide text-neutral-200 font-sans leading-relaxed">
                  Steer Your Vessel
                </h2>
              </div>

              <div className="relative w-64 h-64 my-6 flex items-center justify-center">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i}
                    className="absolute rounded-full border border-emerald-500/10"
                    style={{
                      width: `${i * 50}px`,
                      height: `${i * 50}px`,
                      opacity: 0.15 * (6 - i)
                    }}
                  />
                ))}
                <div className="flex gap-3 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </div>

              <div className="w-full max-w-sm px-4">
                <p className="text-xs text-neutral-400 leading-relaxed mb-6 px-1.5 font-sans">
                  Express yourself via rich interactive media flows. Stand on deck and claim your safe spot.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStage("slide2")}
                    className="h-11 px-4 border border-white/10 rounded-full text-neutral-300 font-semibold text-xs hover:bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStage("auth_options")}
                    className="flex-1 h-12 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 font-bold uppercase tracking-wider text-xs shadow-[0_0_24px_rgba(16,185,129,0.35)] hover:shadow-emerald-500/50 transition-all flex items-center justify-center gap-1"
                  >
                    <span>Proceed to Auth</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 5: AUTH OPTIONS ================= */}
          {stage === "auth_options" && (
            <motion.div
              key="auth_options"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[480px]"
            >
              <div className="pt-4">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Safe Harbor</span>
                <h2 className="text-xl font-bold mt-1 text-white">Claim Your Vessel</h2>
                <p className="text-xs text-neutral-400 mt-1">Authorise to join global stream activity</p>
              </div>

              <div className="w-full max-w-sm space-y-3 px-4">
                <button
                  onClick={() => handleMockAuth("Google")}
                  className="w-full h-11.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-semibold flex items-center px-4 gap-4 hover:bg-white/10 transition-all text-white"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Settle via Google Stream</span>
                </button>

                <button
                  onClick={() => handleMockAuth("Apple")}
                  className="w-full h-11.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-semibold flex items-center px-4 gap-4 hover:bg-white/10 transition-all text-white"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.23.67-2.95 1.51-.62.73-1.16 1.87-1.01 2.98.1.1 1.34 0 2.97-1.43z"/>
                  </svg>
                  <span>Settle via Apple</span>
                </button>

                <button
                  onClick={() => setStage("auth_email")}
                  className="w-full h-11.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 text-xs font-semibold flex items-center px-4 gap-4 hover:bg-emerald-900/40 text-emerald-300 transition-all"
                >
                  <Loader2 className="w-5 h-5 flex-shrink-0 text-emerald-400 rotate-45" />
                  <span>Settle via Mail Vessel</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    toast.info("Entering as Guest Voyager");
                    setStage("step1_interests");
                  }}
                  className="text-xs text-emerald-400 hover:underline tracking-wide font-medium block mx-auto"
                >
                  Sail Directly as Guest Voyage
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 6: AUTH EMAIL FORM ================= */}
          {stage === "auth_email" && (
            <motion.div
              key="auth_email"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col justify-between h-full w-full min-h-[480px] text-left max-w-sm px-4"
            >
              <div className="space-y-4">
                <button 
                  onClick={() => setStage("auth_options")}
                  className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-xs text-neutral-300 flex items-center gap-1 w-max transition-all hover:bg-white/10"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <div>
                  <h2 className="text-xl font-bold text-white leading-tight">
                    {authMode === "signup" ? "Set Sails With Account" : "Dock into Saved Harbour"}
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1">Unlock consistent state stream synchronization</p>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3">
                  {authMode === "signup" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-0.5">Vessel Name (Username)</label>
                      <input
                        type="text"
                        placeholder="captain_hook"
                        value={shoreUsername}
                        onChange={(e) => setShoreUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        className="w-full h-10 px-3.5 rounded-xl bg-white/5 text-white/95 text-xs font-semibold outline-none border border-white/10 focus:border-emerald-500 font-mono transition-all"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-0.5">Email Port</label>
                    <input
                      type="email"
                      placeholder="vessel@ripple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl bg-white/5 text-white/95 text-xs font-semibold outline-none border border-white/10 focus:border-emerald-500 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-0.5">Vessel Key (Password)</label>
                    <input
                      type="password"
                      placeholder="Minimum 6 character code"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl bg-white/5 text-white/95 text-xs font-semibold outline-none border border-white/10 focus:border-emerald-500 transition-all"
                      required
                      minLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingAuth}
                    className="w-full h-11.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1 hover:opacity-95 transition-all disabled:opacity-50 shadow-[0_0_24px_rgba(16,185,129,0.25)]"
                  >
                    {submittingAuth ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>{authMode === "signup" ? "Claim Vessel & Board" : "Secure Log In"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              <button
                type="button"
                onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}
                className="text-xs font-semibold text-emerald-400 hover:underline mx-auto block mt-6"
              >
                {authMode === "signup" ? "Already have an account? Log In" : "Need a vessel? Sign Up"}
              </button>
            </motion.div>
          )}

          {/* ================= STAGE 7: INTERACTIVE CONCENTRIC INTERESTS BOARD ================= */}
          {stage === "step1_interests" && (
            <motion.div
              key="step1_interests"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[520px]"
            >
              <div>
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Stage 1 of 6</span>
                <h2 className="text-xl font-bold mt-1 text-white">Customize Your Ocean</h2>
                <p className="text-xs text-neutral-400 mt-1">Select 3 or more nodes to construct your stream currents</p>
              </div>

              {/* INTEGRATING HIGH FIDELITY EXACT COPY OF SCREENSHOT GRAPHICS WITH DOCK RINGS, BUBBLES, LIQUID BLEND */}
              <div className="relative w-80 h-80 my-2 select-none flex items-center justify-center overflow-visible">
                
                {/* Concentric rings spacing matching screenshot circles */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                  {[40, 95, 150, 210, 270].map((dim) => (
                    <div
                      key={dim}
                      className="absolute rounded-full border border-emerald-500/10"
                      style={{
                        width: `${dim}px`,
                        height: `${dim}px`,
                      }}
                    />
                  ))}
                </div>

                {/* SVG Gooey pill fusion layer strictly representing connected adjacent active icons */}
                <div className="absolute inset-0 pointer-events-none z-0" style={{ filter: "url(#liquid-blend)" }}>
                  {INTERESTS.map((col) => {
                    const isS = selectedInterests.includes(col.id);
                    if (!isS) return null;
                    const coords = getInterestCoords(col.angle, col.radius);
                    return (
                      <motion.div
                        key={`goo-${col.id}`}
                        layoutId={`goo-${col.id}`}
                        className="absolute w-12 h-12 rounded-full bg-emerald-400/40 blur-[3px]"
                        style={{
                          left: `calc(50% + ${coords.x}px - 24px)`,
                          top: `calc(50% + ${coords.y}px - 24px)`,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Crispy actionable translucent interest bubble buttons */}
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  {INTERESTS.map((col) => {
                    const IconComp = col.icon;
                    const isS = selectedInterests.includes(col.id);
                    const coords = getInterestCoords(col.angle, col.radius);

                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => toggleInterest(col.id)}
                        className={`absolute w-11 h-11 rounded-full border flex flex-col items-center justify-center transition-all duration-300 ${
                          isS
                            ? "bg-emerald-950/60 border-emerald-400 text-white shadow-[0_0_15px_rgba(52,211,153,0.45)] scale-110"
                            : "bg-black/60 border-neutral-800 text-neutral-400 hover:border-neutral-500 hover:text-white"
                        }`}
                        style={{
                          left: `calc(50% + ${coords.x}px - 22px)`,
                          top: `calc(50% + ${coords.y}px - 22px)`,
                        }}
                      >
                        <IconComp className={`w-4.5 h-4.5 ${isS ? "text-emerald-300" : "text-neutral-400"}`} />
                        <span className="text-[7.5px] font-bold tracking-tight mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap w-9 text-center">
                          {col.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* iOS style starburst loader and stream action feedback area */}
              <div className="w-full max-w-sm px-4">
                <div className="flex flex-col items-center justify-center gap-2.5 my-4">
                  {selectedInterests.length >= 3 ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-300">
                      {/* Premium starburst loader spinner */}
                      <div className="relative w-5 h-5 animate-spin">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                          <div
                            key={i}
                            className="absolute top-0 left-1/2 w-[2px] h-1.5 bg-white/45 origin-[center_10px] -translate-x-1/2 rounded-full"
                            style={{
                              transform: `translateX(-50%) rotate(${i * 45}deg)`,
                              opacity: 0.3 + (i / 7) * 0.7,
                            }}
                          />
                        ))}
                      </div>
                      <span className="font-medium animate-pulse">Ripples and Currents merging...</span>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400 tracking-wide">
                      Select {3 - selectedInterests.length} more categories to sail
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStage("auth_options")}
                    className="h-11 px-5 bg-white/5 border border-white/5 rounded-full text-neutral-300 font-semibold text-xs hover:bg-white/10"
                  >
                    Back
                  </button>
                  <button
                    disabled={selectedInterests.length < 3}
                    onClick={() => setStage("step2_lagoons")}
                    className="flex-grow h-11 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-98 shadow-glow"
                  >
                    <span>Anchor Lagoons</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 8: CHOOSE YOUR LAGOONS ================= */}
          {stage === "step2_lagoons" && (
            <motion.div
              key="step2_lagoons"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[500px]"
            >
              <div className="w-full max-w-sm">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Stage 2 of 6</span>
                <h2 className="text-xl font-bold mt-1 text-white">Choose Your Lagoons</h2>
                <p className="text-xs text-neutral-400 mt-1">Concentric communities forming waves ({selectedLagoons.length} chosen)</p>
              </div>

              <div className="w-full max-w-sm space-y-2.5 my-3.5 max-h-[310px] overflow-y-auto pr-1">
                {LAGOONS.map((lag) => {
                  const IconLag = lag.icon;
                  const isChecked = selectedLagoons.includes(lag.id);
                  return (
                    <div
                      key={lag.id}
                      onClick={() => {
                        setSelectedLagoons(prev => 
                          prev.includes(lag.id) ? prev.filter(x => x !== lag.id) : [...prev, lag.id]
                        );
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all duration-200 ${
                        isChecked
                          ? "bg-emerald-500/10 border-emerald-400/40 shadow-glow"
                          : "bg-white/[0.03] border-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isChecked ? "bg-emerald-400/20 text-emerald-300" : "bg-white/5 text-neutral-400"}`}>
                          <IconLag className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white mb-0.5 leading-tight">{lag.name}</h4>
                          <p className="text-[10px] text-neutral-400 leading-tight block whitespace-wrap max-w-[210px]">{lag.desc}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                        isChecked ? "bg-emerald-500 border-emerald-400 text-white" : "border-neutral-700"
                      }`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="w-full max-w-sm px-4 flex gap-3">
                <button
                  onClick={() => setStage("step1_interests")}
                  className="h-11 px-5 bg-white/5 border border-white/5 rounded-full text-neutral-300 font-semibold text-xs hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  onClick={() => setStage("step3_creators")}
                  className="flex-grow h-11 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1 shadow-glow"
                >
                  <span>Select Creators</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 9: EXPLORE SUGGESTED CREATORS ================= */}
          {stage === "step3_creators" && (
            <motion.div
              key="step3_creators"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[500px]"
            >
              <div className="w-full max-w-sm">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Stage 3 of 6</span>
                <h2 className="text-xl font-bold mt-1 text-white">Join Core Channels</h2>
                <p className="text-xs text-neutral-400 mt-1">These sailors formulate active currents in your path</p>
              </div>

              <div className="w-full max-w-sm space-y-3 my-4">
                {creators.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    <p className="text-xs text-neutral-400 font-mono">Charting active currents...</p>
                  </div>
                ) : (
                  creators.map((cr) => {
                    const isFollowing = followingCreators.includes(cr.username);
                    return (
                      <div
                        key={cr.id}
                        className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between gap-3 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={cr.avatar} 
                            alt="avatar" 
                            className="w-10 h-10 rounded-xl object-cover bg-neutral-800 border border-white/5" 
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white transition-all overflow-hidden text-ellipsis whitespace-nowrap w-28">{cr.name}</h4>
                            <p className="text-[10px] text-neutral-400">@{cr.username}</p>
                            <p className="text-[9px] text-emerald-400 mt-0.5 leading-none">{cr.followers} currents</p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setFollowingCreators(prev => 
                              prev.includes(cr.username) ? prev.filter(x => x !== cr.username) : [...prev, cr.username]
                            );
                          }}
                          className={`h-7 px-3 rounded-xl text-[10px] font-bold tracking-wide transition-all ${
                            isFollowing 
                              ? "bg-white/10 text-white/80" 
                              : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm"
                          }`}
                        >
                          {isFollowing ? "Watching" : "Observe"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="w-full max-w-sm px-4 flex gap-3">
                <button
                  onClick={() => setStage("step2_lagoons")}
                  className="h-11 px-5 bg-white/5 border border-white/5 rounded-full text-neutral-300 font-semibold text-xs hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  onClick={() => setStage("step4_flow")}
                  className="flex-grow h-11 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1 shadow-glow"
                >
                  <span>Set Flow Type</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 10: USER FLOW PREFERENCES ================= */}
          {stage === "step4_flow" && (
            <motion.div
              key="step4_flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[500px]"
            >
              <div className="w-full max-w-sm">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Stage 4 of 6</span>
                <h2 className="text-xl font-bold mt-1 text-white">How Do You Flow?</h2>
                <p className="text-xs text-neutral-400 mt-1">Fine-tune the content formats you prefer reading & creating</p>
              </div>

              <div className="w-full max-w-sm grid grid-cols-2 gap-3 my-4">
                {FLOW_OPTIONS.map((fl) => {
                  const IconFl = fl.icon;
                  const isChecked = flowTypes.includes(fl.id);
                  return (
                    <div
                      key={fl.id}
                      onClick={() => {
                        setFlowTypes(prev => 
                          prev.includes(fl.id) ? prev.filter(x => x !== fl.id) : [...prev, fl.id]
                        );
                      }}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between h-24 ${
                        isChecked
                          ? "bg-emerald-500/10 border-emerald-400/40 shadow-glow"
                          : "bg-white/[0.03] border-white/5 hover:border-white/12"
                      }`}
                    >
                      <IconFl className={`w-5 h-5 ${isChecked ? "text-emerald-300" : "text-neutral-400"}`} />
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight mb-0.5">{fl.title}</h4>
                        <span className="text-[9px] text-neutral-400 leading-tight block truncate w-[110px]">{fl.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="w-full max-w-sm px-4 flex gap-3">
                <button
                  onClick={() => setStage("step3_creators")}
                  className="h-11 px-5 bg-white/5 border border-white/5 rounded-full text-neutral-300 font-semibold text-xs hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  onClick={() => setStage("step5_waters")}
                  className="flex-grow h-11 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1 shadow-glow"
                >
                  <span>Select Region</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 11: WATERS REGIONS ================= */}
          {stage === "step5_waters" && (
            <motion.div
              key="step5_waters"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[500px]"
            >
              <div className="w-full max-w-sm">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Stage 5 of 6</span>
                <h2 className="text-xl font-bold mt-1 text-white">Select Anchor Region</h2>
                <p className="text-xs text-neutral-400 mt-1">Determine coordinates of regional server feeds</p>
              </div>

              <div className="w-full max-w-sm space-y-3 my-4">
                {[
                  { id: "global", name: "Global Main Streams", meta: "Feeds from everywhere in the world" },
                  { id: "na", name: "North America Stream", meta: "Centred across USA, Canada, Mexico" },
                  { id: "eur", name: "European Currents", meta: "Centred around UK, Germany, France, Spain" },
                  { id: "asia", name: "Asian Coastal Waters", meta: "Centred across India, Japan, Singapore" }
                ].map((reg) => {
                  const isS = selectedRegion === reg.id;
                  return (
                    <div
                      key={reg.id}
                      onClick={() => setSelectedRegion(reg.id)}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer flex items-center justify-between transition-all ${
                        isS 
                          ? "bg-emerald-500/10 border-emerald-400/50 shadow-glow" 
                          : "bg-white/[0.03] border-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isS ? "bg-emerald-400/20 text-emerald-300" : "bg-white/5 text-neutral-400"}`}>
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-white leading-tight">{reg.name}</h4>
                          <span className="text-[10px] text-neutral-400">{reg.meta}</span>
                        </div>
                      </div>
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className={`w-3.5 h-3.5 rounded-full border transition-all ${isS ? "bg-emerald-400 border-white/20" : "border-neutral-700"}`} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="w-full max-w-sm px-4 flex gap-3">
                <button
                  onClick={() => setStage("step4_flow")}
                  className="h-11 px-5 bg-white/5 border border-white/5 rounded-full text-neutral-300 font-semibold text-xs hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  onClick={() => setStage("step6_shore")}
                  className="flex-grow h-11 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1 shadow-glow"
                >
                  <span>Build Shore</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 12: BUILD PROFILE SHORE ================= */}
          {stage === "step6_shore" && (
            <motion.div
              key="step6_shore"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-left flex flex-col justify-between h-full w-full min-h-[500px] max-w-sm px-4"
            >
              <div className="space-y-4">
                <div className="text-center">
                  <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Stage 6 of 6</span>
                  <h2 className="text-xl font-bold mt-1 text-white">Assemble Your Shore</h2>
                  <p className="text-xs text-neutral-400 mt-1">Customize the visual identity other sailors observe</p>
                </div>

                <div className="flex items-center gap-3.5 p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <img src={avatarUrl} alt="avatar" className="w-12 h-12 rounded-2xl bg-black border border-white/10" />
                  <div className="flex-1">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest block">Sailing Identity</span>
                    <span className="text-xs text-emerald-400 font-semibold block mt-0.5">Admin-assigned default avatar active</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-0.5">Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Jack Sparrow"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl bg-white/5 text-white text-xs font-semibold outline-none border border-white/10 focus:border-emerald-500 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-0.5">Vessel Identifier (Username)</label>
                    <input
                      type="text"
                      placeholder="captain_hook"
                      value={shoreUsername}
                      onChange={(e) => setShoreUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      className="w-full h-10 px-3.5 rounded-xl bg-white/5 text-white text-xs font-semibold outline-none border border-white/10 focus:border-emerald-500 font-mono transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-0.5">Shore Bio / Description</label>
                    <textarea
                      placeholder="e.g. Sailing through global code streams in search of beautiful currents..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full h-16 p-3 rounded-xl bg-white/5 text-white text-xs font-medium outline-none border border-white/10 focus:border-emerald-500 resize-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="w-full mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStage("step5_waters")}
                  className="h-11 px-5 bg-white/5 border border-white/5 rounded-full text-neutral-300 font-semibold text-xs hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={saveShoreProfile}
                  className="flex-grow h-11 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-glow"
                >
                  <span>Lock Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 13: NOTIFICATIONS / SYSTEM ACCESS ================= */}
          {stage === "step7_notifications" && (
            <motion.div
              key="step7_notifications"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[500px]"
            >
              <div className="pt-4 max-w-sm">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">System Hook</span>
                <h2 className="text-xl font-bold mt-1 text-white">Alert Tide Notifications</h2>
                <p className="text-xs text-neutral-400 mt-1">Receive signals when mariners like or drop ripples near you</p>
              </div>

              {/* Centered organic bell wave icon container */}
              <div className="relative w-64 h-64 flex items-center justify-center">
                {[1, 2, 3, 4].map((i) => (
                  <div 
                    key={i}
                    className="absolute rounded-full border border-emerald-500/10"
                    style={{
                      width: `${i * 55}px`,
                      height: `${i * 55}px`,
                      opacity: 0.15 * (5 - i)
                    }}
                  />
                ))}
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-glow relative z-10 animate-bounce">
                  <Bell className="w-6.5 h-6.5" />
                </div>
              </div>

              <div className="w-full max-w-sm px-4 space-y-3">
                <button
                  onClick={() => {
                    toast.success("Notification listener authorized successfully!");
                    setStage("building_stream");
                  }}
                  className="w-full h-11.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-1"
                >
                  <span>Authorize Wave Alerts</span>
                </button>

                <button
                  onClick={() => setStage("building_stream")}
                  className="text-xs text-neutral-400 hover:text-white transition-colors uppercase tracking-widest font-bold block mx-auto py-1"
                >
                  Do Not Allow
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 14: BUILDING STREAM COUNTDOWN ================= */}
          {stage === "building_stream" && (
            <motion.div
              key="building_stream"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center flex flex-col items-center justify-center h-full w-full min-h-[500px]"
            >
              <div className="my-8 relative w-64 h-64 flex items-center justify-center">
                {/* Concentric waves */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i}
                    className="absolute rounded-full border border-emerald-500/10"
                    style={{
                      width: `${i * 50}px`,
                      height: `${i * 50}px`,
                      opacity: 0.15 * (6 - i)
                    }}
                  />
                ))}

                <div className="absolute inset-x-0 mx-auto w-40 text-center z-10">
                  {/* High accuracy starburst iOS loader element */}
                  <div className="flex justify-center mb-6">
                    <div className="relative w-8 h-8 animate-spin" style={{ animationDuration: "1.2s" }}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                        <div
                          key={n}
                          className="absolute top-0 left-1/2 w-[2.5px] h-2.5 bg-white origin-[center_16px] -translate-x-1/2 rounded-full"
                          style={{
                            transform: `translateX(-50%) rotate(${n * 30}deg)`,
                            opacity: 0.15 + (n / 11) * 0.85,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-300 animate-pulse tracking-wide leading-tight mt-1">
                    {STREAM_MESSAGES[messageIndex]}
                  </h3>
                </div>

                <div className="absolute bottom-4 text-xs font-mono text-neutral-500">
                  {progress}% Syncing
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= STAGE 15: WELCOME / COMPLETED ================= */}
          {stage === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center flex flex-col items-center justify-between h-full w-full min-h-[500px]"
            >
              <div className="pt-4 max-w-sm">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">Smooth Sailing</span>
                <h2 className="text-2xl font-black mt-2 text-white">Your Currents Are Set!</h2>
                <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed px-5">Your vessel is commissioned and registered into global ripple tides. Smooth water ahead!</p>
              </div>

              {/* Massive ambient concentric sphere of connection */}
              <div className="my-[40px] relative w-64 h-64 flex items-center justify-center">
                <div className="absolute w-64 h-64 border border-emerald-500/10 rounded-full animate-ping scale-110" />
                <div className="absolute w-44 h-44 border border-teal-500/20 rounded-full animate-pulse" />
                <div className="w-18 h-18 rounded-full bg-emerald-500/20 border border-emerald-300/40 flex items-center justify-center text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.4)] relative z-10">
                  <Sparkle className="w-10 h-10 animate-spin" style={{ animationDuration: "12s" }} />
                </div>
              </div>

              <div className="w-full max-w-sm px-4">
                <button
                  onClick={handleFinishOnboarding}
                  className="w-full h-12.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 font-bold uppercase tracking-wider text-xs shadow-[0_0_24px_rgba(16,185,129,0.35)] hover:shadow-emerald-500/50 transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  <span>Enter the Collective Stream</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Humble bottom caption aligning with organic visual theme */}
      <div className="py-2 opacity-50 text-[10px] text-neutral-400 select-none z-10 pointer-events-none tracking-widest uppercase">
        Ripple Sync Engine Active
      </div>
    </div>
  );
};

export default Onboarding;
