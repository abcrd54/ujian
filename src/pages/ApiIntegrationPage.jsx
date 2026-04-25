import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAsyncData } from "../hooks/useAsyncData";
import { getApiIntegrationInfo, regenerateSchoolApiKey } from "../services/dashboardService";
import { hasSupabaseConfig } from "../lib/supabase";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "school_name", label: "Sekolah" },
  { key: "school_id", label: "ID Sekolah" },
  { key: "api_key_masked", label: "Kunci API Sekolah" },
  { key: "status", label: "Status" },
];

export function ApiIntegrationPage() {
  const dataState = useAsyncData(getApiIntegrationInfo);
  const { showToast } = useToast();

  return (
    <>
      <PageHeader
        title="Integrasi API"
        description="Kelola kunci API setiap sekolah untuk kebutuhan integrasi dengan sistem eksternal."
        hideAction
      />
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-100 bg-white p-6 shadow-card">
          <h2 className="mb-2 text-lg font-semibold">Header yang Diperlukan</h2>
          <pre className="rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
{`Authorization: Bearer {ACCESS_TOKEN_SISWA}

Untuk aplikasi siswa, JWT tidak mewajibkan X-School-ID.
Untuk integrasi server sekolah:
Authorization: Bearer {API_KEY}
X-School-ID: {SCHOOL_ID}

Contoh endpoint verifikasi:
GET /api/integration/schools/me`}
          </pre>
        </article>
        <article className="rounded-xl border border-slate-100 bg-white p-6 shadow-card">
          <h2 className="mb-2 text-lg font-semibold">Status Konfigurasi</h2>
          <p className="text-sm text-slate-600">
            Supabase:{" "}
            <span className={hasSupabaseConfig ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
              {hasSupabaseConfig ? "Terhubung" : "Belum terhubung"}
            </span>
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Endpoint siswa menggunakan JWT Supabase. Integrasi server sekolah dapat memverifikasi kunci API melalui endpoint integrasi khusus.
          </p>
        </article>
      </section>
      <AsyncTableCard
        columns={columns}
        dataState={dataState}
        rowKey="id"
        rowActions={(row) => (
          <ActionIconButton
            icon="vpn_key"
            label="Buat ulang kunci API sekolah"
            tone="success"
            onClick={async () => {
              try {
                const result = await regenerateSchoolApiKey(row.id);
                await dataState.reload();
                showToast(`Kunci API baru: ${result.masked_api_key}`);
              } catch (error) {
                showToast(error.message, "error");
              }
            }}
          />
        )}
      />
    </>
  );
}
