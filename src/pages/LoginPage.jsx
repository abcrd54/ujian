import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getDefaultPathByRole } from "../auth/guards";

export function LoginPage() {
  const { user, role, hasSupabaseConfig, signIn, signOut, loading, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user && role !== "siswa") {
    return <Navigate to={location.state?.from || getDefaultPathByRole(role)} replace />;
  }

  if (!loading && user && role === "siswa") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-card">
          <h1 className="text-xl font-semibold text-amber-800">Akses Ditolak</h1>
          <p className="mt-2 text-sm text-amber-700">
            Akun siswa tidak bisa login ke dashboard web. Gunakan aplikasi ujian siswa.
          </p>
          <button
            onClick={signOut}
            className="mt-4 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Keluar
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login gagal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Login SiapUjian</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gunakan akun Supabase Auth dengan role owner, admin, atau guru.
          </p>
        </div>

        {!hasSupabaseConfig && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Konfigurasi Supabase belum diisi. Lengkapi `.env` terlebih dahulu.
          </p>
        )}

        {(error || authError) && (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error || authError}
          </p>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
              placeholder="Masukkan email akun"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
              placeholder="Masukkan password"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !hasSupabaseConfig}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
