import { useState } from "react";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAsyncData } from "../hooks/useAsyncData";
import { approveExam, getReviewQuestions, rejectExam } from "../services/dashboardService";
import { ConfirmModal } from "../ui/ConfirmModal";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "exam", label: "Ujian" },
  { key: "submitted_by", label: "Pengirim" },
  { key: "pg_count", label: "Jumlah PG" },
  { key: "essay_count", label: "Jumlah Esai" },
  { key: "status", label: "Status Tinjauan" },
];

const statusClass = {
  Menunggu: "bg-amber-50 text-amber-700",
  Disetujui: "bg-emerald-50 text-emerald-700",
  Draf: "bg-slate-100 text-slate-700",
  Ditolak: "bg-rose-50 text-rose-700",
};

export function ReviewQuestionsPage() {
  const dataState = useAsyncData(getReviewQuestions);
  const { showToast } = useToast();
  const [decision, setDecision] = useState(null);

  return (
    <>
      <PageHeader
        title="Peninjauan Soal"
        description="Lakukan verifikasi soal pilihan ganda dan esai sebelum ujian dipublikasikan."
        hideAction
      />
      <AsyncTableCard
        columns={columns}
        dataState={dataState}
        rowKey="exam_id"
        filterKey="status"
        filterOptions={[
          { label: "Menunggu", value: "menunggu" },
          { label: "Disetujui", value: "disetujui" },
          { label: "Draf", value: "draf" },
          { label: "Ditolak", value: "ditolak" },
        ]}
        rowActions={(row) =>
          row.status === "Menunggu" || row.status === "Draf" ? (
            <div className="flex justify-end gap-2">
              <ActionIconButton
                icon="task_alt"
                label="Setujui soal ujian"
                tone="success"
                onClick={() => setDecision({ type: "approve", row })}
              />
              <ActionIconButton
                icon="cancel"
                label="Tolak soal ujian"
                tone="danger"
                onClick={() => setDecision({ type: "reject", row })}
              />
            </div>
          ) : null
        }
        renderCell={(row, key) => {
          if (key !== "status") return row[key];
          return (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[row.status] || "bg-slate-100 text-slate-700"}`}>
              {row.status}
            </span>
          );
        }}
      />

      <ConfirmModal
        open={Boolean(decision)}
        title={decision?.type === "approve" ? "Setujui Soal Ujian" : "Tolak Soal Ujian"}
        description={
          decision?.type === "approve"
            ? `Setujui soal untuk ${decision?.row?.exam || "ujian ini"} agar siap dipakai pada pelaksanaan ujian?`
            : `Tolak soal untuk ${decision?.row?.exam || "ujian ini"} dan kembalikan ke guru untuk revisi?`
        }
        onCancel={() => setDecision(null)}
        onConfirm={async () => {
          try {
            if (decision?.type === "approve") {
              await approveExam(decision.row.exam_id);
              showToast("Ujian berhasil disetujui.");
            } else {
              await rejectExam(decision.row.exam_id);
              showToast("Soal ujian ditolak dan dikembalikan ke guru.");
            }
            setDecision(null);
            await dataState.reload();
          } catch (error) {
            setDecision(null);
            showToast(error.message, "error");
          }
        }}
      />
    </>
  );
}
