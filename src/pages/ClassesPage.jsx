import { useMemo, useState } from "react";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import { createClass, deleteClass, getClasses, getSchools, updateClass } from "../services/dashboardService";
import { ConfirmModal } from "../ui/ConfirmModal";
import { FormModal } from "../ui/FormModal";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "name", label: "Kelas" },
  { key: "major", label: "Jurusan" },
  { key: "grade", label: "Tingkat" },
  { key: "students_count", label: "Jumlah Siswa" },
];

const levelOptions = [
  { value: "sd", label: "SD / MI", grades: ["1", "2", "3", "4", "5", "6"] },
  { value: "smp", label: "SMP / MTs", grades: ["7", "8", "9"] },
  { value: "sma", label: "SMA / SMK", grades: ["10", "11", "12"] },
];

const initialForm = { name: "", major: "", grade: "", school_id: "", level: "", parallel: "" };

function inferLevelFromGrade(grade) {
  const value = String(grade || "").trim();
  if (["1", "2", "3", "4", "5", "6"].includes(value)) return "sd";
  if (["7", "8", "9"].includes(value)) return "smp";
  if (["10", "11", "12"].includes(value)) return "sma";
  return "";
}

export function ClassesPage() {
  const { role } = useAuth();
  const dataState = useAsyncData(getClasses);
  const schoolsState = useAsyncData(getSchools);
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);

  const availableGrades = levelOptions.find((item) => item.value === form.level)?.grades || [];
  const needsMajor = form.level === "sma";
  const sortedSchools = useMemo(
    () => [...(schoolsState.rows || [])].sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
    [schoolsState.rows],
  );
  const classNameSuggestion = useMemo(() => {
    const grade = String(form.grade || "").trim();
    const major = String(form.major || "").trim().toUpperCase();
    const parallel = String(form.parallel || "").trim().toUpperCase();
    if (!grade) return "";
    if (form.level === "sd" || form.level === "smp") {
      return parallel ? `${grade}${parallel}` : `Kelas ${grade}`;
    }
    if (form.level === "sma") {
      if (major && parallel) return `${grade} ${major} ${parallel}`;
      if (major) return `${grade} ${major}`;
      return grade;
    }
    return "";
  }, [form.grade, form.level, form.major, form.parallel]);

  function openCreateModal() {
    setEditingId("");
    setForm(initialForm);
    setOpen(true);
  }

  function openEditModal(row) {
    setEditingId(row.id);
    setForm({
      name: row.name === "-" ? "" : row.name,
      major: row.major === "-" ? "" : row.major,
      grade: row.grade === "-" ? "" : row.grade,
      school_id: row.school_id || "",
      level: inferLevelFromGrade(row.grade),
      parallel: "",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!form.level) {
      showToast("Pilih jenjang kelas terlebih dahulu.", "error");
      return;
    }
    if (!form.grade) {
      showToast("Pilih tingkat kelas yang sesuai dengan jenjang.", "error");
      return;
    }
    if (needsMajor && !String(form.major || "").trim()) {
      showToast("Jurusan wajib diisi untuk jenjang SMA / SMK.", "error");
      return;
    }
    if (!String(form.name || "").trim()) {
      showToast("Nama kelas wajib diisi.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        major: needsMajor ? form.major : "",
        grade: form.grade,
        school_id: form.school_id,
      };
      if (editingId) {
        await updateClass(editingId, payload);
      } else {
        await createClass(payload);
      }
      setOpen(false);
      setForm(initialForm);
      setEditingId("");
      await dataState.reload();
      showToast(editingId ? "Kelas berhasil diperbarui." : "Kelas berhasil ditambahkan.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Data Kelas"
        description="Kelola kelas sekolah dengan nama final seperti Kelas 8, 12 MIPA 1, atau 11 RPL 2."
        actionLabel="Tambah Kelas"
        onAction={openCreateModal}
      />

      <AsyncTableCard
        columns={columns}
        dataState={dataState}
        rowKey="id"
        rowActions={(row) => (
          <div className="flex justify-end gap-2">
            <ActionIconButton icon="edit" label="Edit kelas" onClick={() => openEditModal(row)} tone="primary" />
            <ActionIconButton icon="delete" label="Hapus kelas" onClick={() => setDeleteTarget(row)} tone="danger" />
          </div>
        )}
      />

      <FormModal
        open={open}
        title={editingId ? "Edit Kelas" : "Tambah Kelas"}
        description="Pilih jenjang dahulu agar tingkat valid. Nama kelas diisi dengan nama final yang tampil di seluruh sistem."
        submitLabel={editingId ? "Simpan Perubahan" : "Simpan Kelas"}
        onSubmit={handleSubmit}
        onClose={() => {
          setOpen(false);
          setEditingId("");
          setForm(initialForm);
        }}
        submitting={submitting}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama kelas</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Contoh: Kelas 8, 12 MIPA 1, 11 RPL 2"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <span className="mt-1.5 block text-xs text-slate-500">Ini adalah nama final yang akan tampil pada dashboard, jadwal, dan hasil ujian.</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Jurusan</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              placeholder={needsMajor ? "Contoh: MIPA, IPS, RPL, TKJ" : "Tidak dipakai untuk SD / SMP"}
              disabled={!needsMajor}
              value={form.major}
              onChange={(e) => setForm((p) => ({ ...p, major: e.target.value.toUpperCase() }))}
            />
            <span className="mt-1.5 block text-xs text-slate-500">{needsMajor ? "Isi jurusan untuk SMA / SMK." : "Untuk SD / MI dan SMP / MTs, jurusan tidak perlu diisi."}</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Jenjang</span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.level}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  level: e.target.value,
                  grade: "",
                  major: e.target.value === "sma" ? p.major : "",
                  parallel: "",
                }))
              }
            >
              <option value="">Pilih jenjang</option>
              {levelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Tingkat</span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.grade}
              disabled={!form.level}
              onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}
            >
              <option value="">{form.level ? "Pilih tingkat kelas" : "Pilih jenjang dulu"}</option>
              {availableGrades.map((grade) => (
                <option key={grade} value={grade}>
                  Kelas {grade}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Paralel / Rombel</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
              placeholder={form.level === "sd" || form.level === "smp" ? "Contoh: A atau B" : "Contoh: 1 atau 2"}
              value={form.parallel}
              onChange={(e) => setForm((p) => ({ ...p, parallel: e.target.value.toUpperCase() }))}
            />
            <span className="mt-1.5 block text-xs text-slate-500">Opsional. Dipakai untuk membantu saran nama kelas, tidak disimpan terpisah.</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Saran nama kelas</span>
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                value={classNameSuggestion}
                placeholder="Pilih jenjang dan tingkat terlebih dahulu"
                readOnly
              />
              <button
                type="button"
                disabled={!classNameSuggestion}
                onClick={() => setForm((p) => ({ ...p, name: classNameSuggestion }))}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Gunakan
              </button>
            </div>
          </label>

          {role === "owner" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Sekolah</span>
              <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.school_id} onChange={(e) => setForm((p) => ({ ...p, school_id: e.target.value }))}>
                <option value="">Pilih sekolah</option>
                {sortedSchools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </FormModal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Kelas"
        description={`Hapus kelas ${deleteTarget?.name || ""}? Tindakan ini tidak dapat dibatalkan.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteClass(deleteTarget.id);
            setDeleteTarget(null);
            await dataState.reload();
            showToast("Kelas berhasil dihapus.");
          } catch (error) {
            setDeleteTarget(null);
            showToast(error.message, "error");
          }
        }}
      />
    </>
  );
}
