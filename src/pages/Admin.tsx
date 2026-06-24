import { useIsAdmin, useAllUsers, useAllPosts } from "@/hooks/useAdmin";
import { Link, Navigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { 
  Users, 
  FileText, 
  Shield, 
  Trash2, 
  Loader2, 
  BadgeCheck, 
  Search, 
  ArrowLeft, 
  Server, 
  UserCog, 
  Database,
  Cpu,
  LayoutDashboard,
  CheckCircle,
  Clock,
  UserPlus,
  Edit,
  X,
  UserCheck,
  Ban,
  AlertTriangle,
  Plus,
  FilePlus,
  PenTool,
  Compass,
  Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import VerifiedBadge from "@/components/ripple/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
import { resolveUrl } from "@/utils/api";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const { data: users, refetch: refetchUsers } = useAllUsers();
  const { data: posts, refetch: refetchPosts } = useAllPosts();
  const [tab, setTab] = useState<"overview" | "users" | "posts" | "avatars" | "propagation">("overview");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  // --- STATE FOR PROPAGATION MANAGEMENT ---
  const [enableTracking, setEnableTracking] = useState(true);
  const [maxDepth, setMaxDepth] = useState(10);
  const [maxSchedulingDuration, setMaxSchedulingDuration] = useState(365);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // CRUD Records
  const [cpRecords, setCpRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editRecordForm, setEditRecordForm] = useState({
    id: "",
    post_id: "",
    original_post_id: "",
    parent_post_id: "",
    user_id: "",
    parent_user_id: "",
    original_user_id: "",
    share_type: "repost",
    depth: 1
  });

  // Fetch Settings
  useEffect(() => {
    if (tab === "propagation" || tab === "overview") {
      fetch(resolveUrl("/api/propagation/settings"))
        .then(res => res.json())
        .then(data => {
          setEnableTracking(data.enable_propagation_tracking);
          setMaxDepth(data.max_propagation_depth);
          if (data.max_scheduling_duration_days !== undefined) {
            setMaxSchedulingDuration(data.max_scheduling_duration_days);
          }
        })
        .catch(err => console.error("Error loading settings:", err));
    }
  }, [tab]);

  // Fetch Records
  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await fetch(resolveUrl("/api/propagation/records"));
      const data = await res.json();
      setCpRecords(data);
    } catch (err) {
      toast.error("Failed to load propagation records");
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (tab === "propagation") {
      fetchRecords();
    }
  }, [tab]);

  const handleSaveSettings = async () => {
    setUpdatingSettings(true);
    try {
      const res = await fetch(resolveUrl("/api/propagation/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enable_propagation_tracking: enableTracking,
          max_propagation_depth: maxDepth,
          max_scheduling_duration_days: Number(maxSchedulingDuration),
        })
      });
      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("System settings updated globally!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update settings");
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleSaveRecord = async () => {
    try {
      const res = await fetch(resolveUrl("/api/propagation/records/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRecordForm)
      });
      if (!res.ok) throw new Error("Failed to save record");
      toast.success(editRecordForm.id ? "Record updated successfully" : "Record created successfully");
      setRecordModalOpen(false);
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || "Failed to save record");
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm("Are you sure you want to delete this content propagation record?")) return;
    try {
      const res = await fetch(resolveUrl("/api/propagation/records/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error("Failed to delete record");
      toast.success("Record deleted");
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete record");
    }
  };

  const handleExportData = () => {
    window.open(resolveUrl("/api/propagation/export"), "_blank");
  };

  // Load custom health and MySQL connection state
  const { data: dbStatus, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["admin-db-status"],
    queryFn: async () => {
      const response = await fetch(resolveUrl("/api/admin/db-status"));
      if (!response.ok) throw new Error("Could not fetch status");
      return response.json();
    }
  });

  // Query user roles to manage Admin list
  const { data: userRoles, refetch: refetchRoles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data || [];
    }
  });

  // --- STATE FOR USER MODES & CRUD ---
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ email: "", username: "", display_name: "", password: "" });

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUserForm, setEditUserForm] = useState({ user_id: "", username: "", display_name: "", bio: "", is_verified: false, is_onboarding_core: false });

  // --- STATE FOR POST MODES & CRUD ---
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createPostForm, setCreatePostForm] = useState({ user_id: "", caption: "", image_url: "", media_type: "image" });

  const [editPostOpen, setEditPostOpen] = useState(false);
  const [editPostForm, setEditPostForm] = useState({ id: "", caption: "", image_url: "", media_type: "image" });

  const toggleVerified = async (u: any) => {
    const next = !u.is_verified;
    try {
      const res = await fetch(resolveUrl("/api/admin/users/update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u.user_id, is_verified: next })
      });
      if (!res.ok) throw new Error("Failed to change verification");
      toast.success(next ? `@${u.username} verified` : `@${u.username} unverified`);
      refetchUsers();
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      qc.invalidateQueries({ queryKey: ["verified-users"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update verification");
    }
  };

  const toggleOnboardingCore = async (u: any) => {
    const next = !u.is_onboarding_core;
    try {
      const res = await fetch(resolveUrl("/api/admin/users/update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u.user_id, is_onboarding_core: next })
      });
      if (!res.ok) throw new Error("Failed to change core onboarding status");
      toast.success(next ? `@${u.username} is now a core onboarding creator` : `@${u.username} removed from core onboarding`);
      refetchUsers();
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      qc.invalidateQueries({ queryKey: ["onboarding-core-users"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update onboarding core status");
    }
  };

  // --- STATE FOR CUSTOM CONFIRM DIALOG ---
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {}
  });

  const showConfirm = (options: {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }) => {
    setConfirmModal({
      isOpen: true,
      title: options.title,
      description: options.description,
      confirmText: options.confirmText || "Confirm",
      cancelText: options.cancelText || "Cancel",
      onConfirm: () => {
        options.onConfirm();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const deletePost = async (postId: string) => {
    showConfirm({
      title: "Delete Post Permanently?",
      description: "Are you sure you want to delete this post? This will permanently remove the post, along with all its comments, likes, and saved states from the database. This action cannot be undone.",
      confirmText: "Delete Post",
      onConfirm: async () => {
        try {
          const res = await fetch(resolveUrl("/api/admin/posts/delete"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: postId })
          });
          if (!res.ok) throw new Error("Could not delete post");
          toast.success("Post deleted successfully");
          refetchPosts();
          qc.invalidateQueries({ queryKey: ["admin-all-posts"] });
          qc.invalidateQueries({ queryKey: ["posts"] });
        } catch (err: any) {
          toast.error(err.message);
        }
      }
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUserForm.email || !createUserForm.username || !createUserForm.password) {
      toast.error("Please fill required fields (email, username, password).");
      return;
    }
    try {
      const res = await fetch(resolveUrl("/api/admin/users/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createUserForm)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to create user.");
      }
      toast.success(`User @${createUserForm.username} created successfully!`);
      setCreateUserOpen(false);
      setCreateUserForm({ email: "", username: "", display_name: "", password: "" });
      refetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserForm.user_id) return;
    try {
      const res = await fetch(resolveUrl("/api/admin/users/update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editUserForm)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to update user.");
      }
      toast.success("User updated successfully!");
      setEditUserOpen(false);
      refetchUsers();
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    showConfirm({
      title: "CRITICAL SYSTEM WARNING",
      description: `Are you sure you want to permanently delete @${username}? This will thoroughly remove all their posts, replies, likes, follow connections, role, stories, and login credentials from both the live database and fallback storage. This operation is irreversible!`,
      confirmText: "Delete Account Immediately",
      onConfirm: async () => {
        try {
          const res = await fetch(resolveUrl("/api/admin/users/delete"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId })
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || "Failed to execute deletion.");
          }
          toast.success(`User @${username} has been fully deleted from the service.`);
          refetchUsers();
          refetchPosts();
          qc.invalidateQueries({ queryKey: ["admin-all-users"] });
          qc.invalidateQueries({ queryKey: ["admin-all-posts"] });
          qc.invalidateQueries({ queryKey: ["posts"] });
          qc.invalidateQueries({ queryKey: ["profile"] });
        } catch (err: any) {
          toast.error(err.message);
        }
      }
    });
  };

  const toggleBan = async (userId: string, currentBan: boolean) => {
    try {
      const next = !currentBan;
      const res = await fetch(resolveUrl("/api/admin/users/ban"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, is_banned: next })
      });
      if (!res.ok) throw new Error("Could not change ban status");
      toast.success(next ? "Account has been banned from connecting" : "Account ban status lifted");
      refetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleSuspend = async (userId: string, currentSusp: boolean) => {
    try {
      const next = !currentSusp;
      const res = await fetch(resolveUrl("/api/admin/users/suspend"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, is_suspended: next })
      });
      if (!res.ok) throw new Error("Could not change suspend state");
      toast.success(next ? "Account has been suspended" : "Account suspension lifted");
      refetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createPostForm.user_id) {
      toast.error("Please pick an author.");
      return;
    }
    try {
      const res = await fetch(resolveUrl("/api/admin/posts/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPostForm)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to create post.");
      }
      toast.success("Post created successfully!");
      setCreatePostOpen(false);
      setCreatePostForm({ user_id: "", caption: "", image_url: "", media_type: "image" });
      refetchPosts();
      qc.invalidateQueries({ queryKey: ["admin-all-posts"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPostForm.id) return;
    try {
      const res = await fetch(resolveUrl("/api/admin/posts/update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editPostForm)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to edit post.");
      }
      toast.success("Post revised successfully!");
      setEditPostOpen(false);
      refetchPosts();
      qc.invalidateQueries({ queryKey: ["admin-all-posts"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleModeration = async (postId: string, currentModerated: boolean) => {
    try {
      const res = await fetch(resolveUrl("/api/admin/posts/update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: postId,
          is_moderated: !currentModerated
        })
      });
      if (!res.ok) throw new Error("Failed to update moderation");
      toast.success(!currentModerated ? "Post approved for release!" : "Post approval revoked");
      refetchPosts();
      qc.invalidateQueries({ queryKey: ["admin-all-posts"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update moderation status");
    }
  };

  const toggleAdminRole = async (targetUserId: string, isCurrentlyAdmin: boolean) => {
    const executeRoleChange = async () => {
      if (isCurrentlyAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", targetUserId);
        if (error) {
          toast.error("Failed to revoke Admin role: " + error.message);
        } else {
          toast.success("Admin role revoked successfully.");
          qc.invalidateQueries({ queryKey: ["is-admin"] });
          refetchRoles();
        }
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({
            id: Math.random().toString(36).substring(2),
            user_id: targetUserId,
            role: "admin"
          });
        if (error) {
          toast.error("Failed to grant Admin role: " + error.message);
        } else {
          toast.success("Admin role granted successfully.");
          qc.invalidateQueries({ queryKey: ["is-admin"] });
          refetchRoles();
        }
      }
    };

    // If we're demoting ourselves, verify first
    if (targetUserId === user?.id && isCurrentlyAdmin) {
      showConfirm({
        title: "Demote Yourself?",
        description: "Are you sure you want to demote yourself from Admin? You will lose access to this control panel immediately.",
        confirmText: "Demote Me",
        onConfirm: executeRoleChange
      });
    } else {
      executeRoleChange();
    }
  };

  const verifiedCount = useMemo(
    () => (users || []).filter((u: any) => u.is_verified).length,
    [users]
  );

  const adminCount = useMemo(
    () => (userRoles || []).filter((r: any) => r.role === "admin").length,
    [userRoles]
  );

  const filteredUsers = useMemo(() => {
    const base = users || [];
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (u: any) =>
        u.username?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q)
    );
  }, [users, search]);

  if (authLoading || checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground w-full py-8 md:py-12 relative overflow-hidden">
      {/* Decorative ambient glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/3 right-10 w-80 h-80 rounded-full bg-indigo-500/5 blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-[1240px] mx-auto px-4 font-sans relative">
      
      {/* Return to App Button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-xs font-mono tracking-wider font-bold text-muted-foreground hover:text-primary mb-6 uppercase transition-all hover:translate-x-[-2px]"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to feed
      </Link>

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-border/60">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-all">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl md:text-3xl tracking-tight text-foreground">Control Center</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Admin-tier metrics, security directives, and system states.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-mono tracking-wider text-muted-foreground font-bold uppercase">System Console Live</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Admin Inner Navigation Sidebar */}
        <div className="lg:col-span-3 flex flex-row overflow-x-auto lg:flex-col gap-2 pb-4 lg:pb-0 lg:space-y-1.5 scrollbar-none sticky top-6 bg-background/50 backdrop-blur-md z-10 py-1.5 lg:py-0">
          <p className="hidden lg:block text-[10px] font-mono font-bold tracking-wider text-muted-foreground/80 uppercase px-3 mb-2.5">
            System Operations
          </p>
          <button
            onClick={() => setTab("overview")}
            className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl font-display font-extrabold text-sm transition-all text-left lg:w-full border ${
              tab === "overview"
                ? "bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/15"
                : "bg-card border-border/80 text-muted-foreground hover:bg-secondary/80 hover:text-foreground hover:border-border"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Dashboard</span>
          </button>
          
          <button
            onClick={() => setTab("users")}
            className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl font-display font-extrabold text-sm transition-all text-left lg:w-full border ${
              tab === "users"
                ? "bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/15"
                : "bg-card border-border/80 text-muted-foreground hover:bg-secondary/80 hover:text-foreground hover:border-border"
            }`}
          >
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap flex-grow">Users & Roles</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${tab === 'users' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-foreground'}`}>
              {users?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setTab("posts")}
            className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl font-display font-extrabold text-sm transition-all text-left lg:w-full border ${
              tab === "posts"
                ? "bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/15"
                : "bg-card border-border/80 text-muted-foreground hover:bg-secondary/80 hover:text-foreground hover:border-border"
            }`}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap flex-grow">Moderation</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${tab === 'posts' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-foreground'}`}>
              {posts?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setTab("avatars")}
            className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl font-display font-extrabold text-sm transition-all text-left lg:w-full border ${
              tab === "avatars"
                ? "bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/15"
                : "bg-card border-border/80 text-muted-foreground hover:bg-secondary/80 hover:text-foreground hover:border-border"
            }`}
          >
            <PenTool className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Default Avatars</span>
          </button>

          <button
            onClick={() => setTab("propagation")}
            className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl font-display font-extrabold text-sm transition-all text-left lg:w-full border ${
              tab === "propagation"
                ? "bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/15"
                : "bg-card border-border/80 text-muted-foreground hover:bg-secondary/80 hover:text-foreground hover:border-border"
            }`}
          >
            <Compass className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Propagation Settings</span>
          </button>
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-6">
              {/* Highlight statistics cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-card border border-border/80 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg transition-all duration-300 relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all" />
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider">Registered Users</span>
                    <Users className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="font-display font-black text-3xl md:text-4xl text-foreground tracking-tight">{users?.length || 0}</p>
                </div>
                
                <div className="bg-card border border-border/80 rounded-2xl p-5 hover:border-sky-500/30 hover:shadow-lg transition-all duration-300 relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl group-hover:bg-sky-500/10 transition-all" />
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider">Verified Creators</span>
                    <BadgeCheck className="w-4 h-4 text-[#1d9bf0] group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="font-display font-black text-3xl md:text-4xl text-foreground tracking-tight">{verifiedCount}</p>
                </div>

                <div className="bg-card border border-border/80 rounded-2xl p-5 hover:border-indigo-500/30 hover:shadow-lg transition-all duration-300 relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-all" />
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider">Indexed Posts</span>
                    <FileText className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="font-display font-black text-3xl md:text-4xl text-foreground tracking-tight">{posts?.length || 0}</p>
                </div>

                <div className="bg-card border border-border/80 rounded-2xl p-5 hover:border-emerald-500/30 hover:shadow-lg transition-all duration-300 relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all" />
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider">Total Administrators</span>
                    <UserCog className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="font-display font-black text-3xl md:text-4xl text-foreground tracking-tight">{adminCount || 1}</p>
                </div>
              </div>

              {/* Database and Infrastructure Diagnostics */}
              <div className="bg-card border border-border rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-primary/[0.02] rounded-full blur-3xl pointer-events-none" />
                <h3 className="font-display font-extrabold text-base text-foreground mb-5 flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  Database Synchronizer Diagnostics
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-2 border-b border-border/40">
                      <span className="text-muted-foreground">Target Host IP:</span>
                      <span className="text-foreground font-bold tracking-tight">{dbStatus?.host || "131.153.147.178"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/40">
                      <span className="text-muted-foreground">Target Inbound Port:</span>
                      <span className="text-foreground font-medium">3306</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/40">
                      <span className="text-muted-foreground">Schema Identifier:</span>
                      <span className="text-foreground font-bold">{dbStatus?.database || "zerolord_ripple"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center items-start border-t md:border-t-0 md:border-l border-border/60 pt-6 md:pt-0 md:pl-8 space-y-3">
                    <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Synchronizer Status:</p>
                    {dbStatus?.useLocalFallback ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 text-xs font-mono font-bold">
                        <Cpu className="w-3.5 h-3.5" />
                        Fallback Store Active
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-mono font-bold">
                        <CheckCircle className="w-3.5 h-3.5 animate-pulse" />
                        Live cloud SQL Instance Connected
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground leading-relaxed font-sans max-w-sm">
                      If the centralized remote MySQL server becomes unreachable, Ripple clients automatically gracefully switch to secure client-side Local persistence.
                    </p>
                  </div>
                </div>
              </div>

              {/* Logged in Admin Session Detail */}
              <div className="bg-card border border-border/80 rounded-2xl p-5 relative overflow-hidden">
                <h3 className="text-[10px] font-mono font-bold text-muted-foreground mb-4 uppercase tracking-wider">
                  Logged Session Metadata
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center font-display font-black text-foreground border border-border text-lg shadow-sm">
                    {user?.email ? user.email.charAt(0).toUpperCase() : "A"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{user?.email || "anonymous-admin"}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">UID: {user?.id}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER DIRECTORY & ROLES */}
          {tab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search user profile handles by username or name..."
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-sans"
                  />
                </div>
                
                <button
                  onClick={() => setCreateUserOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary text-primary-foreground font-display font-extrabold text-sm shadow-glow hover:bg-primary/90 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Create User
                </button>
              </div>

              {/* USER CREATION PANEL MODAL */}
              {createUserOpen && (
                <div className="p-6 bg-card border-2 border-primary/20 rounded-2xl space-y-4 relative">
                  <button 
                    type="button"
                    onClick={() => setCreateUserOpen(false)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h3 className="font-display font-extrabold text-lg text-foreground flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" /> Create New User Account
                  </h3>
                  <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-muted-foreground block">EMAIL ADDRESS *</label>
                      <input
                        type="email"
                        required
                        value={createUserForm.email}
                        onChange={e => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                        placeholder="e.g. user@ripple.com"
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-muted-foreground block">USERNAME (UNIQUE) *</label>
                      <input
                        type="text"
                        required
                        value={createUserForm.username}
                        onChange={e => setCreateUserForm({ ...createUserForm, username: e.target.value })}
                        placeholder="e.g. ripplesmith"
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-muted-foreground block">DISPLAY NAME</label>
                      <input
                        type="text"
                        value={createUserForm.display_name}
                        onChange={e => setCreateUserForm({ ...createUserForm, display_name: e.target.value })}
                        placeholder="e.g. Ripple Smith"
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-muted-foreground block">PASSWORD *</label>
                      <input
                        type="password"
                        required
                        value={createUserForm.password}
                        onChange={e => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                        placeholder="Enter dynamic credentials..."
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setCreateUserOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs bg-secondary hover:bg-border text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl text-xs bg-primary text-primary-foreground font-bold transition-colors"
                      >
                        Provision Account
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* USER EDIT PANEL MODAL */}
              {editUserOpen && (
                <div className="p-6 bg-card border-2 border-[#1d9bf0]/20 rounded-2xl space-y-4 relative">
                  <button 
                    type="button"
                    onClick={() => setEditUserOpen(false)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h3 className="font-display font-extrabold text-lg text-foreground flex items-center gap-2">
                    <Edit className="w-5 h-5 text-[#1d9bf0]" /> Modify User Profile
                  </h3>
                  <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-muted-foreground block">USERNAME HANDLE</label>
                        <input
                          type="text"
                          required
                          value={editUserForm.username}
                          onChange={e => setEditUserForm({ ...editUserForm, username: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-muted-foreground block">DISPLAY NAME</label>
                        <input
                          type="text"
                          required
                          value={editUserForm.display_name}
                          onChange={e => setEditUserForm({ ...editUserForm, display_name: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-muted-foreground block">BIO DESCRIPTION</label>
                      <textarea
                        value={editUserForm.bio}
                        onChange={e => setEditUserForm({ ...editUserForm, bio: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="edit_verified"
                          checked={editUserForm.is_verified}
                          onChange={e => setEditUserForm({ ...editUserForm, is_verified: e.target.checked })}
                          className="rounded bg-background border-border text-primary focus:ring-primary"
                        />
                        <label htmlFor="edit_verified" className="text-xs font-mono text-foreground cursor-pointer">
                          VERIFIED BADGE STATUS
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="edit_onboarding_core"
                          checked={editUserForm.is_onboarding_core}
                          onChange={e => setEditUserForm({ ...editUserForm, is_onboarding_core: e.target.checked })}
                          className="rounded bg-background border-border text-primary focus:ring-primary"
                        />
                        <label htmlFor="edit_onboarding_core" className="text-xs font-mono text-foreground cursor-pointer">
                          ONBOARDING CORE CHANNEL
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditUserOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs bg-secondary hover:bg-border text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl text-xs bg-primary text-primary-foreground font-bold transition-colors"
                      >
                        Apply Profile Updates
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="space-y-3">
                {filteredUsers.map((u: any) => {
                  const roleObj = userRoles?.find((r: any) => r.user_id === u.user_id);
                  const isUserAdmin = roleObj?.role === "admin";

                  return (
                    <div key={u.id} className="flex flex-col bg-card rounded-2xl px-5 py-5 border border-border hover:border-border/80 transition-all space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <img src={u.avatar_url || ""} className="w-12 h-12 rounded-2xl bg-secondary object-cover flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center flex-wrap gap-1.5">
                              <p className="text-sm font-display font-extrabold text-foreground truncate">
                                {u.username || "No username"}
                              </p>
                              <VerifiedBadge verified={u.is_verified} size={15} />
                              {isUserAdmin && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[9px] font-mono font-bold tracking-tight">
                                  ADMIN
                                </span>
                              )}
                              {u.is_onboarding_core && (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-[9px] font-mono font-bold tracking-tight">
                                  CORE
                                </span>
                              )}
                              {u.is_banned ? (
                                <span className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-[9px] font-mono font-bold tracking-tight flex items-center gap-0.5">
                                  <Ban className="w-2.5 h-2.5" /> BANNED
                                </span>
                              ) : u.is_suspended ? (
                                <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500 text-[9px] font-mono font-bold tracking-tight flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> SUSPENDED
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-mono font-bold tracking-tight">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {u.display_name} · Joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                            </p>
                            <p className="text-xs font-mono text-muted-foreground/80 truncate mt-0.5">
                              ID: {u.user_id}
                            </p>
                          </div>
                        </div>

                        {/* Top action flags: Quick Verify & Quick Admin */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => toggleAdminRole(u.user_id, isUserAdmin)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-semibold transition-colors ${
                              isUserAdmin
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-secondary text-foreground hover:bg-border border border-transparent"
                            }`}
                          >
                            <UserCog className="w-4 h-4" />
                            {isUserAdmin ? "Revoke Admin" : "Make Admin"}
                          </button>

                          <button
                            onClick={() => toggleVerified(u)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-semibold transition-colors ${
                              u.is_verified
                                ? "bg-[#1d9bf0] text-white hover:bg-[#1d9bf0]/90"
                                : "bg-secondary text-foreground hover:bg-border border border-transparent"
                            }`}
                          >
                            <BadgeCheck className="w-4 h-4" />
                            {u.is_verified ? "Verified" : "Verify"}
                          </button>

                          <button
                            onClick={() => toggleOnboardingCore(u)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-semibold transition-colors ${
                              u.is_onboarding_core
                                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                : "bg-secondary text-foreground hover:bg-border border border-transparent"
                            }`}
                          >
                            <Users className="w-4 h-4" />
                            {u.is_onboarding_core ? "Core Channel" : "Make Core"}
                          </button>
                        </div>
                      </div>

                      {/* Display bio for content contextualization */}
                      {u.bio && (
                        <div className="p-3 bg-secondary/30 rounded-xl text-xs text-muted-foreground italic border border-border/40">
                          Bio: "{u.bio}"
                        </div>
                      )}

                      {/* Complete Accounts and Controls Row */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                        <button
                          onClick={() => {
                            setEditUserForm({
                              user_id: u.user_id,
                              username: u.username || "",
                              display_name: u.display_name || "",
                              bio: u.bio || "",
                              is_verified: !!u.is_verified,
                              is_onboarding_core: !!u.is_onboarding_core
                            });
                            setEditUserOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-foreground hover:bg-border text-xs font-semibold transition-colors border border-transparent"
                        >
                          <Edit className="w-3.5 h-3.5 text-blue-500" />
                          Edit Profile
                        </button>

                        <button
                          onClick={() => toggleBan(u.user_id, !!u.is_banned)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                            u.is_banned
                              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-transparent"
                              : "bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border-destructive/20"
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {u.is_banned ? "Unban Account" : "Ban Account"}
                        </button>

                        <button
                          onClick={() => toggleSuspend(u.user_id, !!u.is_suspended)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                            u.is_suspended
                              ? "bg-orange-500 text-white hover:bg-orange-600 border-transparent"
                              : "bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white border-orange-500/20"
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {u.is_suspended ? "Unsuspend Account" : "Suspend Account"}
                        </button>

                        <div className="ml-auto">
                          <button
                            onClick={() => handleDeleteUser(u.user_id, u.username)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground border border-destructive/20 text-destructive text-xs font-bold transition-all"
                            title="Completely delete account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Account
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <div className="text-center bg-card border border-border rounded-2xl py-12">
                    <p className="text-sm text-muted-foreground font-mono">No users match your query filter.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONTENT MODERATION */}
          {tab === "posts" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-card p-4 rounded-2xl border border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">Content Feed Rules</p>
                  <p className="text-xs text-muted-foreground">Admin-authorized post creation and structural caption moderation.</p>
                </div>
                <button
                  onClick={() => setCreatePostOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1d9bf0] text-white hover:bg-[#1d9bf0]/90 rounded-xl text-xs font-bold font-display shadow-sm transition-all"
                >
                  <FilePlus className="w-4 h-4" />
                  Compose Post
                </button>
              </div>

              {/* POST CREATION FORM PANEL */}
              {createPostOpen && (
                <div className="p-6 bg-card border border-border rounded-2xl space-y-4 relative">
                  <button 
                    type="button"
                    onClick={() => setCreatePostOpen(false)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h3 className="font-display font-extrabold text-md text-foreground flex items-center gap-2">
                    <FilePlus className="w-5 h-5 text-primary" /> Create Post as Administrator
                  </h3>
                  <form onSubmit={handleCreatePost} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-muted-foreground block">SELECT AUTHOR SYSTEM USER *</label>
                        <select
                          required
                          value={createPostForm.user_id}
                          onChange={e => setCreatePostForm({ ...createPostForm, user_id: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none"
                        >
                          <option value="">-- Choose User Accessor --</option>
                          {users?.map((usr: any) => (
                            <option key={usr.id} value={usr.user_id}>@{usr.username} - {usr.display_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-muted-foreground block">MEDIA FORMAT TYPE</label>
                        <select
                          value={createPostForm.media_type}
                          onChange={e => setCreatePostForm({ ...createPostForm, media_type: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground"
                        >
                          <option value="image">Still Image Media</option>
                          <option value="text">Pure Text/Message</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-muted-foreground block">IMAGE URL (OPTIONAL)</label>
                        <input
                          type="text"
                          value={createPostForm.image_url}
                          onChange={e => setCreatePostForm({ ...createPostForm, image_url: e.target.value })}
                          placeholder="https://images.unsplash.com/photo-..."
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-muted-foreground block">POST CAPTION OR TEXT CONTENT *</label>
                        <textarea
                          required
                          value={createPostForm.caption}
                          onChange={e => setCreatePostForm({ ...createPostForm, caption: e.target.value })}
                          rows={3}
                          placeholder="Write post announcement content..."
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setCreatePostOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs bg-secondary hover:bg-border text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl text-xs bg-primary text-primary-foreground font-bold transition-colors"
                      >
                        Publish Post to Feed
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* POST EDIT FORM PANEL */}
              {editPostOpen && (
                <div className="p-6 bg-card border-2 border-accent/20 rounded-2xl space-y-4 relative">
                  <button 
                    type="button"
                    onClick={() => setEditPostOpen(false)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h3 className="font-display font-extrabold text-md text-foreground flex items-center gap-2">
                    <Edit className="w-5 h-5 text-accent" /> Edit Post content
                  </h3>
                  <form onSubmit={handleUpdatePost} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-muted-foreground block">MEDIA FORMAT TYPE</label>
                        <select
                          value={editPostForm.media_type}
                          onChange={e => setEditPostForm({ ...editPostForm, media_type: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground"
                        >
                          <option value="image">Still Image Media</option>
                          <option value="text">Pure Text/Message</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-muted-foreground block">IMAGE URL</label>
                        <input
                          type="text"
                          value={editPostForm.image_url}
                          onChange={e => setEditPostForm({ ...editPostForm, image_url: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-muted-foreground block">POST CAPTION OR TEXT CONTENT</label>
                      <textarea
                        required
                        value={editPostForm.caption}
                        onChange={e => setEditPostForm({ ...editPostForm, caption: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditPostOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs bg-secondary hover:bg-border"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl text-xs bg-primary text-primary-foreground font-bold"
                      >
                        Apply Edits
                      </button>
                    </div>
                  </form>
                </div>
              )}
              <div className="space-y-3">
                {posts?.map((p: any) => (
                  <div key={p.id} className="flex items-start gap-4 bg-card rounded-2xl px-5 py-4 border border-border">
                    {p.image_url ? (
                      <img src={p.image_url} className="w-16 h-16 rounded-2xl bg-secondary object-cover flex-shrink-0 border border-border" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center flex-shrink-0 text-muted-foreground font-mono text-xs">
                        Text
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-display font-extrabold text-foreground truncate">{p.profiles?.username || "user"}</p>
                        <VerifiedBadge verified={p.profiles?.is_verified} size={14} />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 mb-2">"{p.caption || "No caption content"}"</p>
                      
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                        <span>{p.likes_count} likes</span>
                        <span>·</span>
                        <span>{p.comments_count} comments</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.status === 'scheduled' && (
                          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            <Clock className="w-3 h-3" /> Scheduled: {new Date(p.scheduled_for).toLocaleString()}
                            {p.is_recurring && ` (Recur: ${p.recurrence_interval})`}
                          </span>
                        )}
                        {p.is_time_capsule && (
                          <span className="inline-flex items-center gap-1 bg-accent/10 text-accent text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            Time Capsule (Unlock: {new Date(p.unlocks_at).toLocaleString()})
                          </span>
                        )}
                        {p.status === 'scheduled' && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            p.is_moderated ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {p.is_moderated ? 'Approved' : 'Pending Moderation'}
                          </span>
                        )}
                      </div>
                    </div>
 
                    <div className="flex items-center gap-1.5">
                      {p.status === 'scheduled' && (
                        <button
                          onClick={() => handleToggleModeration(p.id, p.is_moderated)}
                          className={`p-2.5 rounded-xl hover:bg-secondary border border-transparent hover:border-border transition-all flex-shrink-0 ${
                            p.is_moderated ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                          title={p.is_moderated ? "Unapprove / Reject release" : "Approve for release"}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditPostForm({
                            id: p.id,
                            caption: p.caption || "",
                            image_url: p.image_url || "",
                            media_type: p.media_type || "image"
                          });
                          setEditPostOpen(true);
                        }}
                        className="p-2.5 rounded-xl hover:bg-secondary text-muted-foreground border border-transparent hover:border-border transition-all flex-shrink-0"
                        title="Edit post parameters"
                      >
                        <Edit className="w-4 h-4 text-[#1d9bf0]" />
                      </button>
 
                      <button
                        onClick={() => deletePost(p.id)}
                        className="p-2.5 rounded-xl hover:bg-destructive/10 text-destructive border border-transparent hover:border-destructive/20 transition-all flex-shrink-0"
                        title="Delete Post permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {!posts?.length && (
                  <div className="text-center bg-card border border-border rounded-2xl py-12">
                    <p className="text-sm text-muted-foreground">No posts have been made on the platform yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DEFAULT AVATARS */}
          {tab === "avatars" && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-3xl p-6">
                <div className="mb-4">
                  <h2 className="font-display font-extrabold text-lg text-foreground flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-400 animate-pulse" /> Default Gender-Aware Avatars
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Upload PNG images of brand assets or custom 3D emoji avatars. Brand new users registering on Ripple will automatically get assigned one of these customized default avatars based on their chosen gender category on the signup screen.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(["male", "female", "nonbinary"] as const).map((genderOption) => {
                    return (
                      <GenderAvatarManager
                        key={genderOption}
                        gender={genderOption}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PROPAGATION MANAGEMENT */}
          {tab === "propagation" && (
            <div className="space-y-6">
              {/* Global Settings */}
              <div className="bg-card border border-border rounded-3xl p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-border/40">
                  <div>
                    <h2 className="font-display font-extrabold text-lg text-foreground flex items-center gap-2">
                      <Compass className="w-5 h-5 text-teal-400" /> Wave Propagation Controls
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure tracking systems, limit maximum depth cascades, and export historical trees.
                    </p>
                  </div>

                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-bold text-xs hover:opacity-90 active:scale-95 transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Propagation Data</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Global Toggle */}
                  <div className="bg-[#011413]/40 border border-[#0d5c56]/25 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">Global Propagation Tracking</p>
                      <p className="text-xs text-muted-foreground mt-1">If disabled, new reposts and quotes will not be logged in the propagation ledger.</p>
                    </div>
                    <button
                      onClick={() => setEnableTracking(!enableTracking)}
                      className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 outline-none flex items-center shrink-0 ${
                        enableTracking ? "bg-[#10b981]" : "bg-secondary"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 transform ${
                          enableTracking ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Max Depth */}
                  <div className="bg-[#011413]/40 border border-[#0d5c56]/25 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">Maximum Cascade Depth</p>
                      <p className="text-xs text-muted-foreground mt-1">The maximum nesting level of quoted/reposted trees before halting cascade links.</p>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={maxDepth}
                        onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
                        className="w-24 px-3 py-1.5 rounded-xl bg-black/20 border border-border text-sm text-foreground text-center font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-xs text-muted-foreground font-medium">levels</span>
                    </div>
                  </div>

                  {/* Max Scheduling Duration */}
                  <div className="bg-[#011413]/40 border border-[#0d5c56]/25 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">Max Scheduling Duration</p>
                      <p className="text-xs text-muted-foreground mt-1">Configure the maximum duration in days that users are allowed to schedule posts in advance.</p>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={maxSchedulingDuration}
                        onChange={(e) => setMaxSchedulingDuration(parseInt(e.target.value) || 365)}
                        className="w-24 px-3 py-1.5 rounded-xl bg-black/20 border border-border text-sm text-foreground text-center font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-xs text-muted-foreground font-medium">days</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={updatingSettings}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    {updatingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Settings Globals
                  </button>
                </div>
              </div>

              {/* CRUD Records Table */}
              <div className="bg-card border border-border rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground">Propagation Ledger Database</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Directly view and manipulate recorded share cascades.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditRecordForm({
                        id: "",
                        post_id: "",
                        original_post_id: "",
                        parent_post_id: "",
                        user_id: "",
                        parent_user_id: "",
                        original_user_id: "",
                        share_type: "repost",
                        depth: 1
                      });
                      setRecordModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-white font-display font-bold text-xs hover:opacity-90 active:scale-95 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Record</span>
                  </button>
                </div>

                {loadingRecords ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : cpRecords.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border/50 rounded-2xl bg-[#011413]/10">
                    <p className="text-xs text-muted-foreground italic">No propagation records in the database.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border/60 bg-black/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#011413] text-muted-foreground font-mono font-bold border-b border-border/80 uppercase tracking-wider">
                        <tr>
                          <th className="p-4">Record ID</th>
                          <th className="p-4">Post ID</th>
                          <th className="p-4">Root Post</th>
                          <th className="p-4">Parent Post</th>
                          <th className="p-4">Sharer ID</th>
                          <th className="p-4">Type</th>
                          <th className="p-4">Depth</th>
                          <th className="p-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {cpRecords.map((rec) => (
                          <tr key={rec.id} className="hover:bg-secondary/20 transition-all font-mono text-[11px]">
                            <td className="p-4 text-emerald-400 font-bold max-w-[100px] truncate">{rec.id}</td>
                            <td className="p-4 max-w-[100px] truncate">{rec.post_id}</td>
                            <td className="p-4 max-w-[100px] truncate">{rec.original_post_id || "-"}</td>
                            <td className="p-4 max-w-[100px] truncate">{rec.parent_post_id || "-"}</td>
                            <td className="p-4 max-w-[100px] truncate">{rec.user_id}</td>
                            <td className="p-4 font-bold">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase ${rec.share_type === 'quote' ? 'bg-teal-500/15 text-teal-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                                {rec.share_type}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-foreground">{rec.depth}</td>
                            <td className="p-4 flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditRecordForm({
                                    id: rec.id,
                                    post_id: rec.post_id,
                                    original_post_id: rec.original_post_id || "",
                                    parent_post_id: rec.parent_post_id || "",
                                    user_id: rec.user_id,
                                    parent_user_id: rec.parent_user_id || "",
                                    original_user_id: rec.original_user_id || "",
                                    share_type: rec.share_type,
                                    depth: rec.depth
                                  });
                                  setRecordModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-secondary text-foreground hover:bg-border transition-colors"
                                title="Edit Record"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(rec.id)}
                                className="p-1.5 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Record Create/Edit Modal Overlay */}
          {recordModalOpen && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <div className="bg-card w-full max-w-lg border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all scale-100">
                <div className="flex items-center justify-between mb-5 border-b border-border/30 pb-3">
                  <h3 className="font-display font-extrabold text-base text-foreground flex items-center gap-2">
                    <Compass className="w-5 h-5 text-primary" /> {editRecordForm.id ? "Edit Propagation Record" : "Create Propagation Record"}
                  </h3>
                  <button
                    onClick={() => setRecordModalOpen(false)}
                    className="p-1 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-muted-foreground font-bold mb-1">Post ID</label>
                    <input
                      type="text"
                      value={editRecordForm.post_id}
                      onChange={(e) => setEditRecordForm(prev => ({ ...prev, post_id: e.target.value }))}
                      placeholder="Associated Wave ID"
                      className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground font-bold mb-1">Original Root Post ID</label>
                    <input
                      type="text"
                      value={editRecordForm.original_post_id}
                      onChange={(e) => setEditRecordForm(prev => ({ ...prev, original_post_id: e.target.value }))}
                      placeholder="Root original post ID"
                      className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground font-bold mb-1">Parent Share Post ID</label>
                    <input
                      type="text"
                      value={editRecordForm.parent_post_id}
                      onChange={(e) => setEditRecordForm(prev => ({ ...prev, parent_post_id: e.target.value }))}
                      placeholder="Immediate parent post ID"
                      className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground font-bold mb-1">Sharer User ID</label>
                    <input
                      type="text"
                      value={editRecordForm.user_id}
                      onChange={(e) => setEditRecordForm(prev => ({ ...prev, user_id: e.target.value }))}
                      placeholder="User making this share"
                      className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground font-bold mb-1">Parent User ID</label>
                    <input
                      type="text"
                      value={editRecordForm.parent_user_id}
                      onChange={(e) => setEditRecordForm(prev => ({ ...prev, parent_user_id: e.target.value }))}
                      placeholder="User being shared from"
                      className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground font-bold mb-1">Original Author User ID</label>
                    <input
                      type="text"
                      value={editRecordForm.original_user_id}
                      onChange={(e) => setEditRecordForm(prev => ({ ...prev, original_user_id: e.target.value }))}
                      placeholder="Root original post author"
                      className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground font-bold mb-1">Share Type</label>
                    <select
                      value={editRecordForm.share_type}
                      onChange={(e) => setEditRecordForm(prev => ({ ...prev, share_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#042f2c] border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="repost">Repost</option>
                      <option value="quote">Quote</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-muted-foreground font-bold mb-1">Depth level</label>
                    <input
                      type="number"
                      value={editRecordForm.depth}
                      onChange={(e) => setEditRecordForm(prev => ({ ...prev, depth: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 bg-black/20 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-5 border-t border-border/30 mt-5">
                  <button
                    onClick={() => setRecordModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs bg-secondary hover:bg-border text-foreground transition-all font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRecord}
                    className="px-4 py-2 rounded-xl text-xs bg-primary text-primary-foreground hover:opacity-90 transition-all font-bold"
                  >
                    Save Record
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all scale-100">
            <div className="absolute top-0 left-0 w-full h-1 bg-destructive/50" />
            <div className="mb-5">
              <h3 className="font-display font-extrabold text-lg text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                {confirmModal.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                {confirmModal.description}
              </p>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl text-xs bg-secondary hover:bg-border text-foreground transition-all font-semibold"
              >
                {confirmModal.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2.5 rounded-xl text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all font-bold shadow-lg shadow-destructive/10"
              >
                {confirmModal.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  </div>
  );
};

const GenderAvatarManager = ({ gender }: { gender: "male" | "female" | "nonbinary" }) => {
  const [uploading, setUploading] = useState(false);
  const [currentAvatars, setCurrentAvatars] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const fetchAvatars = async () => {
      try {
        const res = await fetch(resolveUrl("/api/admin/default-avatars"));
        if (res.ok && active) {
          const data = await res.json();
          if (data?.success && data?.configs?.[gender] && Array.isArray(data.configs[gender])) {
            setCurrentAvatars(data.configs[gender]);
          }
        }
      } catch (e) {
        console.error("Error loading default avatars:", e);
      }
    };
    fetchAvatars();
    return () => {
      active = false;
    };
  }, [gender]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("gender", gender);

    try {
      const res = await fetch(resolveUrl("/api/admin/default-avatars"), {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to upload avatar");
      }
      toast.success(`Custom default avatar for ${gender} uploaded successfully!`);
      const data = await res.json();
      if (data?.success && data?.configs?.[gender] && Array.isArray(data.configs[gender])) {
        setCurrentAvatars(data.configs[gender]);
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-secondary/45 rounded-2xl p-5 border border-border/60 relative overflow-hidden flex flex-col justify-between">
      <div>
        <h3 className="font-display font-extrabold text-sm text-foreground capitalize tracking-wide">{gender} Avatars</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Manage custom onboarding defaults</p>
        
        {/* Avatars List */}
        <div className="flex flex-wrap gap-2 mt-4 min-h-[50px] items-center">
          {(!currentAvatars || !Array.isArray(currentAvatars) || currentAvatars.length === 0) ? (
            <p className="text-[11px] text-muted-foreground italic">No custom PNG default avatars uploaded. Using system 3D defaults.</p>
          ) : (
            currentAvatars.map((url, i) => (
              <img
                key={url || i}
                src={url}
                alt=""
                className="w-10 h-10 rounded-xl object-contain bg-background/50 border border-white/5 shadow-inner"
              />
            ))
          )}
        </div>
      </div>

      <div className="mt-5 shrink-0">
        <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-primary/25 hover:border-primary/50 text-xs font-display font-bold text-primary hover:bg-primary/5 transition-all cursor-pointer">
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {uploading ? "Uploading..." : "Upload PNG Avatar"}
          <input
            type="file"
            accept="image/png"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
};

export default Admin;
