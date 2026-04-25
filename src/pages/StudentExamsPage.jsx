import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAsyncData } from "../hooks/useAsyncData";
import { getSchedules } from "../services/dashboardService";

const columns = [
  { key: "exam", label: "Ujian" },
  { key: "class_name", label: "Kelas" },
  { key: "start_time", label: "Mulai" },
  { key: "end_time", label: "Selesai" },
  { key: "status", label: "Status" },
];

export function StudentExamsPage() {
  const dataState = useAsyncData(getSchedules);
  return (
    <>
      <PageHeader
        title="Sesi Ujian Siswa"
        description="Siswa hanya dapat mengakses halaman ini untuk melihat jadwal dan mulai ujian."
        actionLabel="Mulai Ujian"
      />
      <AsyncTableCard columns={columns} dataState={dataState} />
    </>
  );
}
