import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveUrl } from "@/utils/api";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string, gender: string) => {
    try {
      const normalizedUsername = username.toLowerCase().trim();
      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (checkError) {
        console.warn("Could not check duplicate username", checkError.message);
      } else if (existingProfile) {
        return { error: new Error(`The username '${username}' is already taken. Please choose a different one.`) };
      }

      const MALE_AVATARS = [
        "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Liam&backgroundType=gradientLinear&backgroundRotation=120&backgroundColor=0d9488,0ea5e9",
        "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Oliver&backgroundType=gradientLinear&backgroundRotation=180&backgroundColor=0284c7,f43f5e",
        "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Jack&backgroundType=gradientLinear&backgroundRotation=45&backgroundColor=10b981,0d5c56"
      ];
      const FEMALE_AVATARS = [
        "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Sasha&backgroundType=gradientLinear&backgroundRotation=120&backgroundColor=ec4899,8b5cf6",
        "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Ruby&backgroundType=gradientLinear&backgroundRotation=60&backgroundColor=f43f5e,eab308",
        "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Zoe&backgroundType=gradientLinear&backgroundRotation=240&backgroundColor=a855f7,3b82f6"
      ];
      const NONBINARY_AVATARS = [
        "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Alex&backgroundType=gradientLinear&backgroundRotation=120&backgroundColor=6366f1,e0f2fe",
        "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Kai&backgroundType=gradientLinear&backgroundRotation=90&backgroundColor=22c55e,facc15",
        "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Robin&backgroundType=gradientLinear&backgroundRotation=150&backgroundColor=f97316,e11d48"
      ];

      let list = gender === "male" ? MALE_AVATARS : gender === "female" ? FEMALE_AVATARS : NONBINARY_AVATARS;
      
      try {
        const avatarsRes = await fetch(resolveUrl('/api/admin/default-avatars'));
        if (avatarsRes.ok) {
          const avatarsData = await avatarsRes.json();
          if (avatarsData?.success && avatarsData?.configs?.[gender] && avatarsData.configs[gender].length > 0) {
            list = avatarsData.configs[gender];
          }
        }
      } catch (err) {
        console.warn("Could not load dynamic default avatars, falling back", err);
      }

      const defaultAvatar = list[Math.floor(Math.random() * list.length)];

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, display_name: username, needs_onboarding: true, gender, avatar_url: defaultAvatar },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) return { error: error as Error };

      // Immediately backfill/update profiles table with the chosen gender-aware default 3D avatar
      if (data?.user) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            avatar_url: defaultAvatar
          })
          .eq("user_id", data.user.id);
        if (updateError) {
          console.warn("[signUp] Prompt override default avatar update failed:", updateError.message);
        }
      }

      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const refreshUser = async () => {
    const { data: { user: updatedUser } } = await supabase.auth.getUser();
    if (updatedUser) {
      setUser(updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
