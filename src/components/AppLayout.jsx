import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import { navItems } from "../data/navigation";
import { getSchools } from "../services/dashboardService";

export function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const filteredNav = navItems.filter((item) => item.roles.includes(role));
  const schoolsState = useAsyncData(getSchools);
  const school = role === "owner" ? null : schoolsState.rows[0] || null;
  const isSchoolBrandLoading = role !== "owner" && schoolsState.loading && !school;
  const brandName = school?.name || "SiapUjian";
  const brandSubtitle = role === "owner" ? "Panel Manajemen Ujian" : "Panel Manajemen Ujian";
  const logoUrl = school?.logo_url || "";

  return (
    <div className="min-h-screen bg-surface text-text-main">
      <aside className="fixed left-0 top-0 hidden h-screen w-[280px] border-r border-border bg-white px-4 py-6 lg:block">
        <div className="mb-10 flex items-center gap-3 px-2">
          {isSchoolBrandLoading ? (
            <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
          ) : logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
              <span className="material-symbols-outlined">school</span>
            </div>
          )}
          <div>
            {isSchoolBrandLoading ? (
              <div className="space-y-2">
                <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              </div>
            ) : (
              <>
                <p className="line-clamp-2 text-xl font-bold">{brandName}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {brandSubtitle}
                </p>
              </>
            )}
          </div>
        </div>

        <nav className="space-y-1">
          {filteredNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-slate-50 font-semibold text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="lg:ml-[280px]">
        <header className="sticky top-0 z-20 border-b border-border bg-white/90 px-4 py-4 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative w-full max-w-lg">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                search
              </span>
              <input
                type="text"
                placeholder="Cari data guru, siswa, atau ujian..."
                className="w-full rounded-xl border border-transparent bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-200 focus:bg-white"
              />
            </div>
            <div className="ml-auto hidden items-center gap-3 md:flex">
              <button className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-right">
                <p className="text-sm font-semibold">{profile?.full_name || "Pengguna"}</p>
                <p className="text-xs uppercase text-text-muted">{role || "-"}</p>
              </div>
              <button
                onClick={signOut}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Keluar
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-gutter">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
