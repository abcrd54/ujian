import { ActionIconButton } from "../components/ActionIconButton";
import { useState } from "react";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAsyncData } from "../hooks/useAsyncData";
import { getEssayAnswers, gradeEssay } from "../services/dashboardService";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "exam", label: "Ujian" },
  { key: "student", label: "Siswa" },
  { key: "score", label: "Skor" },
  { key: "status", label: "Status" },
];

export function EssayGradingPage() {
  const dataState = useAsyncData(getEssayAnswers);
  const { showToast } = useToast();
  const [scoreMap, setScoreMap] = useState({});

  function normalizeScore(value) {
    if (value === "" || value === null || value === undefined) return "";
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return "";
    return Math.max(0, parsed);
  }

  return (
    <>
      <PageHeader
        title="Koreksi Esai"
        description="Guru menilai jawaban esai untuk ujian yang menjadi tanggung jawabnya."
        hideAction
      />
      <AsyncTableCard
        columns={columns}
        dataState={dataState}
        rowKey="answer_id"
        rowActions={(row) => (
          <div className="flex items-center justify-end gap-2">
            <input
              type="number"
              min="0"
              className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs"
              value={scoreMap[row.answer_id] ?? row.score}
              onChange={(event) =>
                setScoreMap((prev) => ({ ...prev, [row.answer_id]: normalizeScore(event.target.value) }))
              }
            />
            <ActionIconButton
              icon="save"
              label="Simpan nilai esai"
              tone="primary"
              onClick={async () => {
                try {
                  const value = normalizeScore(scoreMap[row.answer_id] ?? row.score ?? 0);
                  if (value === "") {
                    throw new Error("Skor esai wajib diisi dengan angka yang valid.");
                  }
                  await gradeEssay(row.answer_id, value);
                  await dataState.reload();
                  showToast("Nilai esai berhasil disimpan.");
                } catch (error) {
                  showToast(error.message, "error");
                }
              }}
            />
          </div>
        )}
        renderCell={(row, key) => {
          if (key !== "status") return row[key];
          const cls =
            row.status === "Sudah Ditinjau"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700";
          return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{row.status}</span>;
        }}
      />
    </>
  );
}
