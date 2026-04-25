import { useMemo, useRef, useState } from "react";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  createStudent,
  deleteStudent,
  generateStudentUsernames,
  getClasses,
  getSchools,
  getStudents,
  importStudents,
  resetStudentPassword,
  updateStudent,
} from "../services/dashboardService";
import { ConfirmModal } from "../ui/ConfirmModal";
import { FormModal } from "../ui/FormModal";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "nisn", label: "NISN" },
  { key: "full_name", label: "Nama Siswa" },
  { key: "username", label: "Username" },
  { key: "class_name", label: "Kelas" },
  { key: "status", label: "Status" },
];

const initialForm = {
  full_name: "",
  nisn: "",
  username: "",
  class_id: "",
  status: "active",
  school_id: "",
};

function statusBadgeClass(status) {
  return String(status).toLowerCase() === "active"
    ? "bg-emerald-50 text-emerald-700"
    : "bg-slate-100 text-slate-700";
}

export function StudentsPage() {
  const { role } = useAuth();
  const dataState = useAsyncData(getStudents);
  const classesState = useAsyncData(getClasses);
  const schoolsState = useAsyncData(getSchools);
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const sortedClasses = useMemo(
    () => [...(classesState.rows || [])].sort((left, right) => Number(left.grade || 0) - Number(right.grade || 0) || String(left.name || "").localeCompare(String(right.name || ""))),
    [classesState.rows],
  );
  const sortedSchools = useMemo(
    () => [...(schoolsState.rows || [])].sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
    [schoolsState.rows],
  );

  function openCreateModal() {
    setEditingId("");
    setForm(initialForm);
    setOpen(true);
  }

  function openEditModal(row) {
    setEditingId(row.id);
    setForm({
      full_name: row.full_name === "-" ? "" : row.full_name,
      nisn: row.nisn === "-" ? "" : row.nisn,
      username: row.username === "-" ? "" : row.username,
      class_id: classesState.rows.find((item) => item.name === row.class_name)?.id || "",
      status: row.status || "active",
      school_id: row.school_id || "",
    });
    setOpen(true);
  }

  async function handleCreate() {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        username: String(form.username || "").trim() || String(form.nisn || "").trim(),
      };
      if (editingId) {
        await updateStudent(editingId, payload);
      } else {
        await createStudent(payload);
      }
      setOpen(false);
      setForm(initialForm);
      setEditingId("");
      await dataState.reload();
      showToast(editingId ? "Siswa berhasil diperbarui." : "Siswa berhasil ditambahkan.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importStudents(file, form.school_id);
      await dataState.reload();
      showToast("Impor data siswa berhasil.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <>
      <PageHeader
        title="Data Siswa"
        description="Kelola data siswa, impor data Excel, pembuatan username, dan pengaturan ulang kata sandi."
        actionLabel="Tambah Siswa"
        onAction={openCreateModal}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
        <button onClick={() => fileRef.current?.click()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-card">
          Impor Data Excel
        </button>
        <button
          onClick={() => setConfirmGenerate(true)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-card"
        >
          Buat Username Otomatis
        </button>
      </div>

      <AsyncTableCard
        columns={columns}
        dataState={dataState}
        rowKey="id"
        renderCell={(row, key) => {
          if (key !== "status") return row[key];
          return (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
              {String(row.status).toLowerCase()}
            </span>
          );
        }}
        rowActions={(row) => (
          <div className="flex justify-end gap-2">
            <ActionIconButton icon="edit" label="Edit siswa" onClick={() => openEditModal(row)} tone="primary" />
            <ActionIconButton
              icon="lock_reset"
              label="Atur ulang kata sandi siswa"
              onClick={() => setResetTarget(row)}
              tone="success"
            />
            <ActionIconButton icon="delete" label="Hapus siswa" onClick={() => setDeleteTarget(row)} tone="danger" />
          </div>
        )}
      />

      <FormModal
        open={open}
        title={editingId ? "Edit Siswa" : "Tambah Siswa"}
        description="Lengkapi data siswa sebelum disimpan ke sistem."
        submitLabel={editingId ? "Simpan Perubahan" : "Simpan Siswa"}
        onSubmit={handleCreate}
        onClose={() => {
          setOpen(false);
          setEditingId("");
          setForm(initialForm);
        }}
        submitting={submitting}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama siswa</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Masukkan nama siswa" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">NISN</span>
            <input inputMode="numeric" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Masukkan NISN" value={form.nisn} onChange={(e) => setForm((p) => ({ ...p, nisn: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Username</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Masukkan username siswa" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
            <span className="mt-1.5 block text-xs text-slate-500">Jika dikosongkan, sistem akan memakai NISN. Username hanya perlu unik dalam sekolah yang sama.</span>
          </label>
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
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Status</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak aktif</option>
            </select>
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
        open={confirmGenerate}
        title="Buat Username Otomatis"
        description="Sistem akan mengisi username siswa yang masih kosong berdasarkan pola sekolah saat ini. Lanjutkan?"
        onCancel={() => setConfirmGenerate(false)}
        onConfirm={async () => {
          try {
            await generateStudentUsernames(form.school_id);
            setConfirmGenerate(false);
            await dataState.reload();
            showToast("Pembuatan username berhasil.");
          } catch (error) {
            setConfirmGenerate(false);
            showToast(error.message, "error");
          }
        }}
      />

      <ConfirmModal
        open={Boolean(resetTarget)}
        title="Reset Password Siswa"
        description={`Reset password ${resetTarget?.full_name || "siswa"} ke default Siswa123!?`}
        onCancel={() => setResetTarget(null)}
        onConfirm={async () => {
          try {
            await resetStudentPassword(resetTarget.id, resetTarget.id, "Siswa123!");
            showToast(`Kata sandi untuk ${resetTarget.full_name} berhasil diatur ulang ke Siswa123!`);
            setResetTarget(null);
          } catch (error) {
            setResetTarget(null);
            showToast(error.message, "error");
          }
        }}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Siswa"
        description={`Hapus data ${deleteTarget?.full_name || "siswa"}? Tindakan ini tidak dapat dibatalkan.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteStudent(deleteTarget.id);
            setDeleteTarget(null);
            await dataState.reload();
            showToast("Siswa berhasil dihapus.");
          } catch (error) {
            setDeleteTarget(null);
            showToast(error.message, "error");
          }
        }}
      />
    </>
  );
}
