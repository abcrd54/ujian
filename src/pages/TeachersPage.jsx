import { useMemo, useRef, useState } from "react";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  createTeacher,
  deleteTeacher,
  getSchools,
  getTeachers,
  importTeachers,
  updateTeacher,
} from "../services/dashboardService";
import { ConfirmModal } from "../ui/ConfirmModal";
import { FormModal } from "../ui/FormModal";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "nip", label: "NIP" },
  { key: "full_name", label: "Nama Guru" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telepon" },
  { key: "status", label: "Status" },
];

const initialForm = {
  nip: "",
  full_name: "",
  email: "",
  phone: "",
  status: "active",
  school_id: "",
};

function statusBadgeClass(status) {
  return String(status).toLowerCase() === "active"
    ? "bg-emerald-50 text-emerald-700"
    : "bg-slate-100 text-slate-700";
}

export function TeachersPage() {
  const { role } = useAuth();
  const dataState = useAsyncData(getTeachers);
  const schoolsState = useAsyncData(getSchools);
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
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
      nip: row.nip === "-" ? "" : row.nip,
      full_name: row.full_name === "-" ? "" : row.full_name,
      email: row.email === "-" ? "" : row.email,
      phone: row.phone === "-" ? "" : row.phone,
      status: row.status || "active",
      school_id: row.school_id || "",
    });
    setOpen(true);
  }

  async function handleCreate() {
    setSubmitting(true);
    try {
      if (editingId) {
        await updateTeacher(editingId, form);
      } else {
        await createTeacher(form);
      }
      setOpen(false);
      setForm(initialForm);
      setEditingId("");
      await dataState.reload();
      showToast(editingId ? "Guru berhasil diperbarui." : "Guru berhasil ditambahkan.");
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
      await importTeachers(file, form.school_id);
      await dataState.reload();
      showToast("Impor data guru berhasil.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <>
      <PageHeader
        title="Data Guru"
        description="Kelola akun guru, impor data Excel, dan informasi kontak."
        actionLabel="Tambah Guru"
        onAction={openCreateModal}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-card"
        >
          Impor Data Excel
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
            <ActionIconButton icon="edit" label="Edit guru" onClick={() => openEditModal(row)} tone="primary" />
            <ActionIconButton icon="delete" label="Hapus guru" onClick={() => setDeleteTarget(row)} tone="danger" />
          </div>
        )}
      />

      <FormModal
        open={open}
        title={editingId ? "Edit Guru" : "Tambah Guru"}
        description="Lengkapi data guru sebelum disimpan ke sistem."
        submitLabel={editingId ? "Simpan Perubahan" : "Simpan Guru"}
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
            <span className="mb-1.5 block text-sm font-medium text-slate-700">NIP</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Masukkan NIP" value={form.nip} onChange={(e) => setForm((p) => ({ ...p, nip: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama guru</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Masukkan nama guru" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
            <input type="email" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Masukkan email guru" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value.toLowerCase() }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nomor telepon</span>
            <input type="tel" inputMode="tel" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Masukkan nomor telepon" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
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
        open={Boolean(deleteTarget)}
        title="Hapus Guru"
        description={`Hapus data ${deleteTarget?.full_name || "guru"}? Tindakan ini tidak dapat dibatalkan.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteTeacher(deleteTarget.id);
            setDeleteTarget(null);
            await dataState.reload();
            showToast("Guru berhasil dihapus.");
          } catch (error) {
            setDeleteTarget(null);
            showToast(error.message, "error");
          }
        }}
      />
    </>
  );
}
