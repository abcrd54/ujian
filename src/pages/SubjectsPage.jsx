import { useMemo, useState } from "react";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  createSubject,
  deleteSubject,
  getClasses,
  getSchools,
  getSubjects,
  getTeachers,
  updateSubject,
} from "../services/dashboardService";
import { ConfirmModal } from "../ui/ConfirmModal";
import { FormModal } from "../ui/FormModal";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "code", label: "Kode" },
  { key: "name", label: "Mata Pelajaran" },
  { key: "class_name", label: "Kelas" },
  { key: "teacher_name", label: "Guru Pengampu" },
];

const initialForm = { code: "", name: "", class_id: "", teacher_id: "", school_id: "" };

export function SubjectsPage() {
  const { role } = useAuth();
  const dataState = useAsyncData(getSubjects);
  const classesState = useAsyncData(getClasses);
  const teachersState = useAsyncData(getTeachers);
  const schoolsState = useAsyncData(getSchools);
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const sortedClasses = useMemo(
    () => [...(classesState.rows || [])].sort((left, right) => Number(left.grade || 0) - Number(right.grade || 0) || String(left.name || "").localeCompare(String(right.name || ""))),
    [classesState.rows],
  );
  const sortedTeachers = useMemo(
    () => [...(teachersState.rows || [])].sort((left, right) => String(left.full_name || "").localeCompare(String(right.full_name || ""))),
    [teachersState.rows],
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
      code: row.code === "-" ? "" : row.code,
      name: row.name === "-" ? "" : row.name,
      class_id: classesState.rows.find((item) => item.name === row.class_name)?.id || "",
      teacher_id:
        teachersState.rows.find((item) => item.full_name === row.teacher_name)?.profile_id ||
        teachersState.rows.find((item) => item.full_name === row.teacher_name)?.id ||
        "",
      school_id: row.school_id || "",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (editingId) {
        await updateSubject(editingId, form);
      } else {
        await createSubject(form);
      }
      setOpen(false);
      setForm(initialForm);
      setEditingId("");
      await dataState.reload();
      showToast(editingId ? "Mata pelajaran berhasil diperbarui." : "Mata pelajaran berhasil ditambahkan.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Data Mata Pelajaran"
        description="Kelola mata pelajaran dan penugasan guru pengampu."
        actionLabel="Tambah Mata Pelajaran"
        onAction={openCreateModal}
      />

      <AsyncTableCard
        columns={columns}
        dataState={dataState}
        rowKey="id"
        rowActions={(row) => (
          <div className="flex justify-end gap-2">
            <ActionIconButton icon="edit" label="Edit mata pelajaran" onClick={() => openEditModal(row)} tone="primary" />
            <ActionIconButton icon="delete" label="Hapus mata pelajaran" onClick={() => setDeleteTarget(row)} tone="danger" />
          </div>
        )}
      />

      <FormModal
        open={open}
        title={editingId ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}
        description="Atur kode, nama, kelas, dan guru pengampu."
        submitLabel={editingId ? "Simpan Perubahan" : "Simpan Mata Pelajaran"}
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
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Kode mata pelajaran</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase" placeholder="Contoh: MAT-10A" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama mata pelajaran</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Masukkan nama mata pelajaran" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
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
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Guru pengampu</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.teacher_id} onChange={(e) => setForm((p) => ({ ...p, teacher_id: e.target.value }))}>
              <option value="">Pilih guru</option>
              {sortedTeachers.map((item) => (
                <option key={item.id} value={item.profile_id || item.id}>
                  {item.full_name}
                </option>
              ))}
            </select>
          </label>
          {role === "owner" ? (
            <label className="block md:col-span-2">
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
        title="Hapus Mata Pelajaran"
        description={`Hapus mata pelajaran ${deleteTarget?.name || ""}? Tindakan ini tidak dapat dibatalkan.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteSubject(deleteTarget.id);
            setDeleteTarget(null);
            await dataState.reload();
            showToast("Mata pelajaran berhasil dihapus.");
          } catch (error) {
            setDeleteTarget(null);
            showToast(error.message, "error");
          }
        }}
      />
    </>
  );
}
