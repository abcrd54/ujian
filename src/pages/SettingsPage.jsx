import { useAsyncData } from "../hooks/useAsyncData";
import { PageHeader } from "../components/PageHeader";
import { getSettings } from "../services/dashboardService";

export function SettingsPage() {
  const dataState = useAsyncData(getSettings);

  if (dataState.loading) {
    return (
      <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-card">
        <div className="space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="h-16 animate-pulse rounded bg-slate-100" />
        </div>
      </section>
    );
  }

  const settings = dataState.rows || {};

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi sekolah, preferensi ujian, dan keamanan akun admin."
        hideAction
      />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-100 bg-white p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold">Profil Scope</h2>
          <div className="space-y-3 text-sm text-slate-600">
            <p>Nama: {settings.school?.name || "-"}</p>
            <p>NPSN: {settings.school?.npsn || "-"}</p>
            <p>Status: {settings.school?.status || "-"}</p>
            <p>Alamat: {settings.school?.address || "-"}</p>
            <p>Role Aktif: {settings.role || "-"}</p>
          </div>
        </article>
        <article className="rounded-xl border border-slate-100 bg-white p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold">Keamanan</h2>
          <div className="space-y-3 text-sm text-slate-600">
            <p>RLS Supabase: {settings.security?.rls ? "Aktif" : "Nonaktif"}</p>
            <p>Rate Limit Endpoint Publik: {settings.security?.rate_limit ? "Aktif" : "Nonaktif"}</p>
            <p>API Key Masking: {settings.security?.api_key_masking ? "Aktif" : "Nonaktif"}</p>
          </div>
        </article>
      </section>
    </>
  );
}

