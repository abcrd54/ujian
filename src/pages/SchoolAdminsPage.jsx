import { useCallback, useMemo, useState } from "react";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAsyncData } from "../hooks/useAsyncData";
import { createSchoolAdmin, getAccounts, getSchools, resetSchoolAdminPassword, updateAccount } from "../services/dashboardService";
import { FormModal } from "../ui/FormModal";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "school_name", label: "Sekolah" },
  { key: "admin_name", label: "Admin" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
];

const initialCreateForm = {
  full_name: "",
  email: "",
  password: "",
  confirm_password: "",
  phone: "",
  school_id: "",
};

const initialResetForm = {
  new_password: "",
};

export function SchoolAdminsPage() {
  const schoolsState = useAsyncData(getSchools);
  const adminFetcher = useCallback(() => getAccounts({ role: "admin" }), []);
  const accountsState = useAsyncData(adminFetcher);
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [form, setForm] = useState({ school_id: "", status: "active" });
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [resetForm, setResetForm] = useState(initialResetForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const sortedSchools = useMemo(
    () => [...(schoolsState.rows || [])].sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
    [schoolsState.rows],
  );

  const rows = useMemo(() => {
    const schoolMap = new Map((schoolsState.rows || []).map((school) => [school.id, school.name]));
    return (accountsState.rows || []).map((item) => ({
      id: item.id,
      school_id: item.school_id || "",
      school_name: schoolMap.get(item.school_id) || "Belum dipetakan",
      admin_name: item.full_name || item.email || "-",
      email: item.email || "-",
      status: item.status || "-",
    }));
  }, [accountsState.rows, schoolsState.rows]);

  return (
    <>
      <PageHeader
        title="Manajemen Admin Sekolah"
        description="Owner menetapkan admin sekolah dan sekarang juga bisa membuat akun admin langsung dari dashboard."
        actionLabel="Tambah Admin Sekolah"
        actionIcon="person_add"
        onAction={() => {
          setCreateForm(initialCreateForm);
          setCreateOpen(true);
        }}
      />

      <AsyncTableCard
        columns={columns}
        dataState={{ ...accountsState, rows }}
        rowKey="id"
        rowActions={(row) => (
          <div className="flex justify-end gap-2">
            <ActionIconButton
              icon="password"
              label="Reset password admin sekolah"
              tone="success"
              onClick={() => {
                setResetTarget(row);
                setResetForm(initialResetForm);
              }}
            />
            <ActionIconButton
              icon="edit"
              label="Atur admin sekolah"
              tone="primary"
              onClick={() => {
                setEditing(row);
                setForm({ school_id: row.school_id || "", status: row.status || "active" });
              }}
            />
          </div>
        )}
        renderCell={(row, key) => {
          if (key !== "status") return row[key];
          const cls = String(row.status).toLowerCase() === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
          return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{row.status}</span>;
        }}
        emptyMessage="Belum ada akun admin sekolah. Tambahkan admin pertama langsung dari halaman ini."
      />

      <FormModal
        open={createOpen}
        title="Tambah Admin Sekolah"
        description="Sistem akan membuat akun login Supabase Auth sekaligus profile admin sekolah yang aktif."
        submitLabel="Buat Admin"
        onSubmit={async () => {
          setCreating(true);
          try {
            if (!createForm.school_id) throw new Error("Sekolah wajib dipilih.");
            if (!createForm.email) throw new Error("Email admin wajib diisi.");
            if (createForm.password.length < 8) throw new Error("Password minimal 8 karakter.");
            if (createForm.password !== createForm.confirm_password) {
              throw new Error("Konfirmasi password admin tidak sama.");
            }
            await createSchoolAdmin({
              full_name: createForm.full_name,
              email: createForm.email,
              password: createForm.password,
              phone: createForm.phone,
              school_id: createForm.school_id,
            });
            setCreateOpen(false);
            setCreateForm(initialCreateForm);
            await accountsState.reload();
            showToast("Admin sekolah berhasil dibuat.");
          } catch (error) {
            showToast(error.message, "error");
          } finally {
            setCreating(false);
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitting={creating}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama lengkap</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={createForm.full_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, full_name: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
            <input type="email" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={createForm.email} onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value.toLowerCase() }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
            <input type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={createForm.password} onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))} />
            <span className="mt-1.5 block text-xs text-slate-500">Gunakan minimal 8 karakter.</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Konfirmasi password</span>
            <input type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={createForm.confirm_password} onChange={(event) => setCreateForm((prev) => ({ ...prev, confirm_password: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">No. telepon</span>
            <input type="tel" inputMode="tel" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={createForm.phone} onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Sekolah</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={createForm.school_id} onChange={(event) => setCreateForm((prev) => ({ ...prev, school_id: event.target.value }))}>
              <option value="">Pilih sekolah</option>
              {sortedSchools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </label>
        </div>
      </FormModal>

      <FormModal
        open={Boolean(resetTarget)}
        title="Reset Password Admin Sekolah"
        description={`Masukkan password baru untuk ${resetTarget?.admin_name || "admin sekolah"}.`}
        submitLabel="Reset Password"
        onSubmit={async () => {
          setResetting(true);
          try {
            if (resetForm.new_password.length < 8) {
              throw new Error("Password baru minimal 8 karakter.");
            }
            await resetSchoolAdminPassword(resetTarget.id, resetForm.new_password);
            setResetTarget(null);
            setResetForm(initialResetForm);
            showToast("Password admin sekolah berhasil direset.");
          } catch (error) {
            showToast(error.message, "error");
          } finally {
            setResetting(false);
          }
        }}
        onClose={() => setResetTarget(null)}
        submitting={resetting}
        size="sm"
      >
        <div className="grid grid-cols-1 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Password baru</span>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={resetForm.new_password}
              onChange={(event) => setResetForm({ new_password: event.target.value })}
            />
            <span className="mt-1.5 block text-xs text-slate-500">Minimal 8 karakter.</span>
          </label>
        </div>
      </FormModal>

      <FormModal
        open={Boolean(editing)}
        title="Atur Admin Sekolah"
        description="Pastikan admin terhubung ke sekolah yang benar sebelum akun diaktifkan."
        submitLabel="Simpan Perubahan"
        onSubmit={async () => {
          setSubmitting(true);
          try {
            if (!form.school_id) throw new Error("Sekolah admin wajib dipilih.");
            await updateAccount(editing.id, { role: "admin", school_id: form.school_id, status: form.status });
            setEditing(null);
            await accountsState.reload();
            showToast("Admin sekolah berhasil diperbarui.");
          } catch (error) {
            showToast(error.message, "error");
          } finally {
            setSubmitting(false);
          }
        }}
        onClose={() => setEditing(null)}
        submitting={submitting}
      >
        <div className="grid grid-cols-1 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Sekolah</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.school_id} onChange={(event) => setForm((prev) => ({ ...prev, school_id: event.target.value }))}>
              <option value="">Pilih sekolah</option>
              {sortedSchools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Status akun</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="active">Aktif</option>
              <option value="pending">Pending</option>
              <option value="inactive">Nonaktif</option>
              <option value="blocked">Blokir</option>
            </select>
          </label>
        </div>
      </FormModal>
    </>
  );
}
