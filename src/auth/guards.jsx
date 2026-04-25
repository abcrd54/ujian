import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function getDefaultPathByRole(role) {
  if (role === "owner" || role === "admin" || role === "guru") return "/dashboard";
  return "/login";
}

export function RequireAuth({ children }) {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-slate-500">
        Memuat sesi...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequireRole({ allowedRoles, children }) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-card">
        <p className="text-sm text-slate-500">Memeriksa izin akses...</p>
      </div>
    );
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={getDefaultPathByRole(role)} replace />;
  }

  return children;
}

export function RequireWebRole({ children }) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-slate-500">
        Memeriksa akses dashboard...
      </div>
    );
  }

  if (role === "siswa") {
    return <Navigate to="/login" replace state={{ blocked: "siswa" }} />;
  }

  return children;
}
