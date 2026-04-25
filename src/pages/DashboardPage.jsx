import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import { getDashboardSummary } from "../services/dashboardService";

const statusClass = {
  Terjadwal: "bg-blue-50 text-blue-700",
  Menunggu: "bg-amber-50 text-amber-700",
  Draf: "bg-slate-100 text-slate-700",
  Disetujui: "bg-emerald-50 text-emerald-700",
  active: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  inactive: "bg-slate-100 text-slate-700",
  blocked: "bg-rose-50 text-rose-700",
};

export function DashboardPage() {
  const { role } = useAuth();
  const dataState = useAsyncData(getDashboardSummary);

  if (dataState.loading) {
    return (
      <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-card">
        <div className="space-y-3">
          <div className="h-5 w-1/4 animate-pulse rounded bg-slate-200" />
          <div className="h-24 animate-pulse rounded bg-slate-100" />
          <div className="h-40 animate-pulse rounded bg-slate-100" />
        </div>
      </section>
    );
  }

  if (dataState.error) {
    return (
      <section className="rounded-xl border border-rose-100 bg-rose-50 p-6 shadow-card">
        <p className="text-sm text-rose-700">{dataState.error}</p>
      </section>
    );
  }

  const dashboard = dataState.rows || {};
  const isOwner = role === "owner";

  return (
    <>
      <PageHeader
        title="Beranda"
        description={
          isOwner
            ? "Pantau sekolah yang terhubung, admin sekolah, dan akun yang masih menunggu penetapan role."
            : "Pantau data guru, siswa, perkembangan penyusunan soal, dan jadwal ujian sesuai peran aktif."
        }
        hideAction
      />
      <StatCards items={dashboard.stats || []} />

      <section className="mb-6 grid grid-cols-12 gap-4">
        <article className="col-span-12 rounded-xl border border-slate-100 bg-white p-6 shadow-card lg:col-span-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{isOwner ? "Cakupan Platform" : "Gambaran Aktivitas Ujian"}</h2>
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-600">Data scope saat ini</span>
          </div>
          <div className="h-[240px] rounded-xl bg-gradient-to-b from-blue-50 to-white p-4">
            <div className="flex h-full items-end gap-2">
              {(dashboard.stats || []).map((item) => {
                const value = Number(item.value || 0);
                return (
                  <div key={item.label} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <div
                      className="w-full rounded-t-md bg-blue-500/80"
                      style={{ height: `${Math.max(18, value * 12)}px` }}
                    />
                    <span className="text-center text-[10px] text-slate-500">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </article>

        <article className="col-span-12 rounded-xl border border-slate-100 bg-white p-6 shadow-card lg:col-span-4">
          <h2 className="mb-4 text-lg font-semibold">Informasi Terkini</h2>
          <div className="space-y-4 text-sm">
            {(dashboard.activities || []).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </article>
      </section>

      <DataTable
        columns={dashboard.tableColumns || []}
        rows={dashboard.rows || []}
        rowKey="id"
        emptyMessage={isOwner ? "Belum ada admin sekolah yang dipetakan." : "Belum ada data ujian pada scope role ini."}
        renderCell={(row, key) => {
          if (key !== "status") return row[key];
          return (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[row.status] || "bg-slate-100 text-slate-700"}`}>
              {row.status}
            </span>
          );
        }}
      />
    </>
  );
}
