import { useMemo, useState } from "react";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  createSchedule,
  deleteSchedule,
  getClasses,
  getExams,
  getSchedules,
  getSchools,
  updateSchedule,
} from "../services/dashboardService";
import { ConfirmModal } from "../ui/ConfirmModal";
import { FormModal } from "../ui/FormModal";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "exam", label: "Ujian" },
  { key: "class_name", label: "Kelas" },
  { key: "start_time", label: "Mulai" },
  { key: "end_time", label: "Selesai" },
  { key: "status", label: "Status" },
];

const initialForm = {
  exam_id: "",
  class_id: "",
  start_time: "",
  end_time: "",
  status: "scheduled",
  school_id: "",
};

const statusMap = {
  scheduled: "Terjadwal",
  draft: "Draf",
  inactive: "Tidak aktif",
};

function statusBadgeClass(status) {
  const key = String(status).toLowerCase();
  if (key === "terjadwal" || key === "scheduled") return "bg-blue-50 text-blue-700";
  if (key === "draft") return "bg-slate-100 text-slate-700";
  return "bg-amber-50 text-amber-700";
}

export function SchedulesPage() {
  const { role } = useAuth();
  const dataState = useAsyncData(getSchedules);
  const examsState = useAsyncData(getExams);
  const classesState = useAsyncData(getClasses);
  const schoolsState = useAsyncData(getSchools);
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const sortedExams = useMemo(
    () =>
      [...(examsState.rows || [])].sort(
        (left, right) =>
          String(left.bundle_title || "").localeCompare(String(right.bundle_title || "")) ||
          String(left.subject || left.title || "").localeCompare(String(right.subject || right.title || "")),
      ),
    [examsState.rows],
  );
  const sortedClasses = useMemo(
    () =>
      [...(classesState.rows || [])].sort(
        (left, right) =>
          Number(left.grade || 0) - Number(right.grade || 0) ||
          String(left.name || "").localeCompare(String(right.name || "")),
      ),
    [classesState.rows],
  );
  const selectedExam = useMemo(
    () => (examsState.rows || []).find((item) => item.id === form.exam_id) || null,
    [examsState.rows, form.exam_id],
  );
  const selectedClass = useMemo(
    () => (classesState.rows || []).find((item) => item.id === form.class_id) || null,
    [classesState.rows, form.class_id],
  );

  function openCreateModal() {
    setEditingId("");
    setForm(initialForm);
    setOpen(true);
  }

  function openEditModal(row) {
    setEditingId(row.id);
    setForm({
      exam_id: row.exam_id || "",
      class_id: row.class_id || "",
      start_time: row.raw_start_time ? row.raw_start_time.slice(0, 16) : "",
      end_time: row.raw_end_time ? row.raw_end_time.slice(0, 16) : "",
      status: row.raw_status || "scheduled",
      school_id: row.school_id || "",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (!form.exam_id) throw new Error("Ujian wajib dipilih.");
      if (!form.class_id) throw new Error("Kelas ujian belum terhubung. Periksa item bundle yang dipilih.");
      if (!form.start_time || !form.end_time) throw new Error("Waktu mulai dan selesai wajib diisi.");
      if (new Date(form.end_time) <= new Date(form.start_time)) {
        throw new Error("Waktu selesai harus lebih besar dari waktu mulai.");
      }
      if (editingId) {
        await updateSchedule(editingId, form);
      } else {
        await createSchedule(form);
      }
      setOpen(false);
      setForm(initialForm);
      setEditingId("");
      await dataState.reload();
      showToast(editingId ? "Jadwal ujian berhasil diperbarui." : "Jadwal ujian berhasil dibuat.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Jadwal Ujian"
        description="Kelola jadwal mulai, jadwal selesai, dan status pelaksanaan ujian siswa."
        actionLabel="Tambah Jadwal"
        onAction={openCreateModal}
      />

      <AsyncTableCard
        columns={columns}
        dataState={dataState}
        rowKey="id"
        renderCell={(row, key) => {
          if (key !== "status") return row[key];
          return (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
              {row.status}
            </span>
          );
        }}
        rowActions={(row) => (
          <div className="flex justify-end gap-2">
            <ActionIconButton icon="edit_calendar" label="Edit jadwal" onClick={() => openEditModal(row)} tone="primary" />
            <ActionIconButton icon="delete" label="Hapus jadwal" onClick={() => setDeleteTarget(row)} tone="danger" />
          </div>
        )}
      />

      <FormModal
        open={open}
        title={editingId ? "Edit Jadwal Ujian" : "Tambah Jadwal Ujian"}
        description="Pilih ujian, kelas, dan waktu pelaksanaan."
        submitLabel={editingId ? "Simpan Perubahan" : "Simpan Jadwal"}
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
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Ujian</span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.exam_id}
              onChange={(e) => {
                const exam = (examsState.rows || []).find((item) => item.id === e.target.value);
                setForm((p) => ({ ...p, exam_id: e.target.value, class_id: exam?.class_id || "" }));
              }}
            >
              <option value="">Pilih ujian</option>
              {sortedExams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.bundle_title !== "-" ? `${item.bundle_title} / ` : ""}{item.subject} / {item.class_name}
                </option>
              ))}
            </select>
          </label>
          {selectedExam?.class_id ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Kelas</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                value={selectedClass?.name || selectedExam.class_name || "-"}
                readOnly
              />
              <span className="mt-1.5 block text-xs text-slate-500">Kelas mengikuti item ujian yang dipilih agar jadwal tidak salah sasaran.</span>
            </label>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Kelas</span>
              <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.class_id} onChange={(e) => setForm((p) => ({ ...p, class_id: e.target.value }))}>
                <option value="">Pilih kelas</option>
                {sortedClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Waktu mulai</span>
            <input type="datetime-local" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.start_time} onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Waktu selesai</span>
            <input type="datetime-local" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.end_time} onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Status</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="scheduled">{statusMap.scheduled}</option>
              <option value="draft">{statusMap.draft}</option>
              <option value="inactive">{statusMap.inactive}</option>
            </select>
          </label>
          {role === "owner" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Sekolah</span>
              <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.school_id} onChange={(e) => setForm((p) => ({ ...p, school_id: e.target.value }))}>
                <option value="">Pilih sekolah</option>
                {schoolsState.rows.map((school) => (
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
        title="Hapus Jadwal"
        description={`Hapus jadwal ${deleteTarget?.exam || ""}? Tindakan ini tidak dapat dibatalkan.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteSchedule(deleteTarget.id);
            setDeleteTarget(null);
            await dataState.reload();
            showToast("Jadwal berhasil dihapus.");
          } catch (error) {
            setDeleteTarget(null);
            showToast(error.message, "error");
          }
        }}
      />
    </>
  );
}
