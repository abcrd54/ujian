import { useMemo, useState } from "react";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAsyncData } from "../hooks/useAsyncData";
import { getAccounts, getSchools, updateAccount } from "../services/dashboardService";
import { FormModal } from "../ui/FormModal";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "full_name", label: "Nama" },
  { key: "email", label: "Email" },
  { key: "school_name", label: "Sekolah" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
];

const initialForm = {
  full_name: "",
  phone: "",
  role: "siswa",
  status: "pending",
  school_id: "",
};

export function AccountsPage() {
  const accountsState = useAsyncData(getAccounts);
  const schoolsState = useAsyncData(getSchools);
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const sortedSchools = useMemo(
    () => [...(schoolsState.rows || [])].sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
    [schoolsState.rows],
  );

  const rows = useMemo(() => {
    const schoolMap = new Map((schoolsState.rows || []).map((school) => [school.id, school.name]));
    return (accountsState.rows || []).map((item) => ({
      ...item,
      school_name: schoolMap.get(item.school_id) || (item.role === "owner" ? "Global Owner" : "Belum dipetakan"),
    }));
  }, [accountsState.rows, schoolsState.rows]);

  return (
    <>
      <PageHeader
        title="Manajemen Role & Akun"
        description="Owner menetapkan role, status, dan sekolah untuk akun yang sudah terdaftar di sistem."
        hideAction
      />

      <AsyncTableCard
        columns={columns}
        dataState={{ ...accountsState, rows }}
        rowKey="id"
        filterKey="role"
        filterOptions={[
          { label: "Owner", value: "owner" },
          { label: "Admin", value: "admin" },
          { label: "Guru", value: "guru" },
          { label: "Siswa", value: "siswa" },
        ]}
        rowActions={(row) => (
          <ActionIconButton
            icon="manage_accounts"
            label="Atur role akun"
            tone="primary"
            onClick={() => {
              setEditing(row);
              setForm({
                full_name: row.full_name || "",
                phone: row.phone || "",
                role: row.role || "siswa",
                status: row.status || "pending",
                school_id: row.school_id || "",
              });
            }}
          />
        )}
        renderCell={(row, key) => {
          if (key === "status") {
            const cls = String(row.status).toLowerCase() === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700";
            return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{row.status}</span>;
          }
          if (key === "role") {
            return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{row.role}</span>;
          }
          return row[key];
        }}
      />

      <FormModal
        open={Boolean(editing)}
        title="Atur Role Akun"
        description="Gunakan halaman ini untuk aktivasi akun dan pemetaan sekolah."
        submitLabel="Simpan Perubahan"
        onSubmit={async () => {
          setSubmitting(true);
          try {
            if (form.role !== "owner" && !form.school_id) {
              throw new Error("Akun non-owner wajib dipetakan ke sekolah.");
            }
            await updateAccount(editing.id, form);
            setEditing(null);
            await accountsState.reload();
            showToast("Role akun berhasil diperbarui.");
          } catch (error) {
            showToast(error.message, "error");
          } finally {
            setSubmitting(false);
          }
        }}
        onClose={() => setEditing(null)}
        submitting={submitting}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama lengkap</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.full_name} onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Role</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value, school_id: event.target.value === "owner" ? "" : prev.school_id }))}>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="guru">Guru</option>
              <option value="siswa">Siswa</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Status</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="pending">Pending</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="blocked">Blokir</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Sekolah</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.school_id} disabled={form.role === "owner"} onChange={(event) => setForm((prev) => ({ ...prev, school_id: event.target.value }))}>
              <option value="">{form.role === "owner" ? "Owner tidak terikat sekolah" : "Pilih sekolah"}</option>
              {sortedSchools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-slate-500">Owner bersifat global. Admin, guru, dan siswa harus terhubung ke satu sekolah.</span>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">No. telepon</span>
            <input type="tel" inputMode="tel" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
          </label>
        </div>
      </FormModal>
    </>
  );
}
