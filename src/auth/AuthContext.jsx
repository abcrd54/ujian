import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

const AuthContext = createContext(null);
const authCache = {
  session: null,
  profile: null,
  role: null,
  hydrated: false,
};

function normalizeRole(roleValue) {
  const role = (roleValue || "").toLowerCase();
  if (role === "owner" || role.includes("super_admin") || role.includes("superadmin")) {
    return "owner";
  }
  if (role.includes("admin")) return "admin";
  if (role.includes("guru") || role.includes("teacher")) return "guru";
  return "siswa";
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, school_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchProfileFallback(user) {
  const profileId = user?.user_metadata?.profile_id;
  if (profileId) {
    const byMeta = await supabase
      .from("profiles")
      .select("id, full_name, role, school_id, email")
      .eq("id", profileId)
      .maybeSingle();
    if (byMeta.error) throw byMeta.error;
    if (byMeta.data) return byMeta.data;
  }

  if (user?.email) {
    const byEmail = await supabase
      .from("profiles")
      .select("id, full_name, role, school_id, email")
      .eq("email", user.email)
      .maybeSingle();
    if (byEmail.error) throw byEmail.error;
    if (byEmail.data) return byEmail.data;
  }

  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(authCache.session);
  const [profile, setProfile] = useState(authCache.profile);
  const [role, setRole] = useState(authCache.role);
  const [loading, setLoading] = useState(!authCache.hydrated);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasSupabaseConfig) {
      authCache.hydrated = true;
      setLoading(false);
      return;
    }

    let mounted = true;

    async function syncSession(activeSession) {
      if (!mounted) return;
      setSession(activeSession);
      authCache.session = activeSession;

      const user = activeSession?.user;
      if (!user) {
        setProfile(null);
        setRole(null);
        authCache.profile = null;
        authCache.role = null;
        authCache.hydrated = true;
        setLoading(false);
        return;
      }

      try {
        let dbProfile = await fetchProfile(user.id);
        if (!dbProfile) {
          dbProfile = await fetchProfileFallback(user);
        }
        if (!mounted) return;
        const mergedProfile = dbProfile || {
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email,
          role: user.user_metadata?.role || "siswa",
        };
        setProfile(mergedProfile);
        setRole(normalizeRole(mergedProfile.role));
        authCache.profile = mergedProfile;
        authCache.role = normalizeRole(mergedProfile.role);
        setError("");
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Gagal memuat profil");
        setProfile(null);
        setRole(null);
        authCache.profile = null;
        authCache.role = null;
      } finally {
        authCache.hydrated = true;
        if (mounted) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      syncSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      syncSession(activeSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email, password) {
    if (!hasSupabaseConfig) {
      throw new Error("Konfigurasi Supabase belum diisi.");
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  }

  async function signOut() {
    if (!hasSupabaseConfig) return;
    await supabase.auth.signOut();
  }

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      role,
      loading,
      error,
      hasSupabaseConfig,
      signIn,
      signOut,
    }),
    [session, profile, role, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return context;
}
