import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Waves, ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setReady(true);
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true);
        else navigate("/auth");
      });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    toast.success("Password updated!");
    navigate("/");
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center">
            <Waves className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">Ripple</h1>
        </div>
        <div className="bg-card rounded-2xl p-6 shadow-elevated border border-border">
          <h2 className="font-display text-xl font-bold text-foreground mb-1">New password</h2>
          <p className="text-sm text-muted-foreground mb-6">Choose a strong new password</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 pr-12 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground font-medium outline-none focus:ring-2 focus:ring-primary"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl gradient-brand text-primary-foreground font-display font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <div className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <>Update Password <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
