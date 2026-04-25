import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import { getTeacherTasks, submitExamQuestions } from "../services/dashboardService";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "exam", label: "Ujian" },
  { key: "teacher", label: "Guru" },
  { key: "deadline", label: "Batas Akhir Soal" },
  { key: "progress", label: "Progres" },
];

export function TeacherTasksPage() {
  const { role } = useAuth();
  const dataState = useAsyncData(getTeacherTasks);
  const { showToast } = useToast();
  return (
    <>
      <PageHeader
        title="Penugasan Guru"
        description="Pantau perkembangan penyusunan soal oleh guru pada setiap ujian."
        hideAction
      />
      <AsyncTableCard
        columns={columns}
        dataState={dataState}
        rowKey="id"
        rowActions={(row) =>
          role === "guru" && row.raw_status === "draft" ? (
            <ActionIconButton
              icon="send"
              label="Kirim soal"
              tone="success"
              onClick={async () => {
                try {
                  await submitExamQuestions(row.id);
                  await dataState.reload();
                  showToast("Soal berhasil dikirim kepada admin.");
                } catch (error) {
                  showToast(error.message, "error");
                }
              }}
            />
          ) : null
        }
      />
    </>
  );
}
