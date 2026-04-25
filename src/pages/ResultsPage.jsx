import { useCallback, useMemo, useState } from "react";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAsyncData } from "../hooks/useAsyncData";
import { exportResults, getExamBundles, getExams, getResults } from "../services/dashboardService";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "bundle", label: "Bundle" },
  { key: "subject", label: "Mapel" },
  { key: "class_name", label: "Kelas" },
  { key: "student_name", label: "Siswa" },
  { key: "average_score", label: "Nilai" },
  { key: "completed", label: "Status Pengerjaan" },
  { key: "status", label: "Status Nilai" },
];

export function ResultsPage() {
  const { showToast } = useToast();
  const [filters, setFilters] = useState({ bundle_id: "", exam_id: "", class_id: "" });

  const bundlesState = useAsyncData(getExamBundles);
  const examsState = useAsyncData(getExams);
  const resultFetcher = useCallback(() => {
    if (!filters.bundle_id) return Promise.resolve([]);
    return getResults(filters);
  }, [filters]);
  const resultsState = useAsyncData(resultFetcher, [filters.bundle_id, filters.exam_id, filters.class_id]);

  const bundleScopedExams = useMemo(() => {
    const rows = examsState.rows || [];
    if (!filters.bundle_id) return [];
    return rows.filter((exam) => exam.bundle_id === filters.bundle_id);
  }, [examsState.rows, filters.bundle_id]);

  const classOptions = useMemo(() => {
    const source = filters.exam_id
      ? bundleScopedExams.filter((exam) => exam.id === filters.exam_id)
      : bundleScopedExams;
    return [...new Map(source.map((exam) => [exam.class_id, exam.class_name])).entries()].map(([id, name]) => ({ id, name }));
  }, [bundleScopedExams, filters.exam_id]);

  return (
    <>
      <PageHeader
        title="Hasil Ujian"
        description="Lihat hasil berdasarkan bundle ujian, lalu persempit ke mapel dan kelas agar evaluasi lebih fokus."
        actionLabel="Unduh CSV"
        onAction={async () => {
          try {
            await exportResults("csv", filters);
            showToast("Unduhan CSV telah dimulai.");
          } catch (error) {
            showToast(error.message, "error");
          }
        }}
      />

      <section className="mb-4 grid grid-cols-1 gap-4 rounded-3xl bg-white p-5 shadow-card md:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Bundle ujian</span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={filters.bundle_id}
            onChange={(event) =>
              setFilters({ bundle_id: event.target.value, exam_id: "", class_id: "" })
            }
          >
            <option value="">Pilih bundle</option>
            {bundlesState.rows.map((bundle) => (
              <option key={bundle.id} value={bundle.id}>
                {bundle.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Mapel</span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={filters.exam_id}
            onChange={(event) => setFilters((previous) => ({ ...previous, exam_id: event.target.value, class_id: "" }))}
            disabled={!filters.bundle_id}
          >
            <option value="">Semua mapel dalam bundle</option>
            {bundleScopedExams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.subject} • {exam.class_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Kelas</span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={filters.class_id}
            onChange={(event) => setFilters((previous) => ({ ...previous, class_id: event.target.value }))}
            disabled={!filters.bundle_id}
          >
            <option value="">Semua kelas</option>
            {classOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end justify-end gap-2">
          <ActionIconButton
            icon="picture_as_pdf"
            label="Unduh PDF"
            tone="danger"
            onClick={async () => {
              try {
                await exportResults("pdf", filters);
                showToast("Unduhan PDF telah dimulai.");
              } catch (error) {
                showToast(error.message, "error");
              }
            }}
          />
        </div>
      </section>

      <AsyncTableCard columns={columns} dataState={resultsState} rowKey="id" emptyMessage="Pilih bundle ujian untuk menampilkan hasil." />
    </>
  );
}
