import { useEffect, useState } from "react";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  createSchool,
  deleteSchool,
  getSchoolApiKey,
  getSchools,
  regenerateSchoolApiKey,
  uploadSchoolLogo,
  updateSchool,
} from "../services/dashboardService";
import { ConfirmModal } from "../ui/ConfirmModal";
import { FormModal } from "../ui/FormModal";
import { useToast } from "../ui/ToastContext";

const columns = [
  { key: "logo", label: "Logo" },
  { key: "name", label: "Nama Sekolah" },
  { key: "npsn", label: "NPSN" },
  { key: "address", label: "Alamat" },
  { key: "status", label: "Status" },
  { key: "api_key_masked", label: "Kunci API Sekolah" },
];

const initialForm = { name: "", npsn: "", address: "", status: "active", logo_url: "" };

function statusBadgeClass(status) {
  return String(status).toLowerCase() === "active"
    ? "bg-emerald-50 text-emerald-700"
    : "bg-slate-100 text-slate-700";
}

export function SchoolsPage() {
  const { role } = useAuth();
  const dataState = useAsyncData(getSchools);
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [apiKeyTarget, setApiKeyTarget] = useState(null);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(initialForm);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const isOwner = role === "owner";
  const school = dataState.rows[0] || null;
  const activeSchools = dataState.rows.filter((item) => String(item.status).toLowerCase() === "active").length;
  const inactiveSchools = Math.max(dataState.rows.length - activeSchools, 0);

  useEffect(() => {
    if (!apiKeyTarget?.id) {
      setApiKeyValue("");
      return;
    }

    let mounted = true;
    async function loadApiKey() {
      setApiKeyLoading(true);
      try {
        const result = await getSchoolApiKey(apiKeyTarget.id);
        if (mounted) setApiKeyValue(result.api_key || "");
      } catch (_error) {
        if (mounted) setApiKeyValue("");
      } finally {
        if (mounted) setApiKeyLoading(false);
      }
    }

    loadApiKey();
    return () => {
      mounted = false;
    };
  }, [apiKeyTarget?.id]);

  function openCreateModal() {
    setEditingId("");
    setForm(initialForm);
    setLogoFile(null);
    setLogoPreview("");
    setOpen(true);
  }

  function openEditModal(row) {
    setEditingId(row.id);
    setForm({
      name: row.name === "-" ? "" : row.name,
      npsn: row.npsn === "-" ? "" : row.npsn,
      address: row.address === "-" ? "" : row.address,
      status: row.status || "active",
      logo_url: row.logo_url || "",
    });
    setLogoFile(null);
    setLogoPreview(row.logo_url || "");
    setOpen(true);
  }

  async function handleSave() {
    setSubmitting(true);
    try {
      let savedSchool = null;
      if (editingId) {
        savedSchool = await updateSchool(editingId, form);
        showToast("Data sekolah berhasil diperbarui.");
      } else {
        savedSchool = await createSchool(form);
        showToast("Data sekolah berhasil ditambahkan.");
      }
      if (logoFile && savedSchool?.id) {
        const uploadResult = await uploadSchoolLogo(savedSchool.id, logoFile);
        savedSchool = { ...savedSchool, logo_url: uploadResult.logo_url || "" };
      }
      setOpen(false);
      setEditingId("");
      setForm(initialForm);
      setLogoFile(null);
      setLogoPreview("");
      await dataState.reload();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerate(id) {
    try {
      const result = await regenerateSchoolApiKey(id);
      setApiKeyValue(result.api_key || "");
      await dataState.reload();
      showToast(`Kunci API baru: ${result.masked_api_key}`);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleCopyApiKey() {
    if (!apiKeyValue) {
      showToast("Kunci API sekolah belum tersedia.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(apiKeyValue);
      showToast("Kunci API sekolah berhasil disalin.");
    } catch (_error) {
      showToast("Penyalinan kunci API sekolah tidak berhasil.", "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Data Sekolah"
        description="Kelola profil sekolah, status keaktifan, dan kunci API untuk integrasi."
        actionLabel="Tambah Sekolah"
        onAction={isOwner ? openCreateModal : undefined}
        hideAction={!isOwner}
      />

      {isOwner ? (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl bg-white p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Total Sekolah</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{dataState.rows.length}</p>
              <p className="mt-2 text-sm text-slate-500">Sekolah yang sudah terdaftar di platform.</p>
            </article>
            <article className="rounded-3xl bg-white p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sekolah Aktif</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-700">{activeSchools}</p>
              <p className="mt-2 text-sm text-slate-500">Sekolah yang bisa langsung digunakan admin sekolah.</p>
            </article>
            <article className="rounded-3xl bg-white p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Perlu Tindak Lanjut</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-700">{inactiveSchools}</p>
              <p className="mt-2 text-sm text-slate-500">Sekolah nonaktif yang perlu dicek sebelum dipakai kembali.</p>
            </article>
          </section>

          <section className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
            <article className="rounded-3xl bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Onboarding Sekolah</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Data Sekolah Terhubung</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Owner hanya perlu mendaftarkan sekolah, memastikan statusnya aktif, lalu menyerahkan operasional harian ke admin sekolah.
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Tahapan owner: <span className="font-semibold text-slate-900">buat sekolah | set admin | pantau</span>
                </div>
              </div>

              {dataState.rows.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <p className="text-lg font-semibold text-slate-900">Belum ada sekolah terdaftar</p>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Mulai dari membuat sekolah pertama. Setelah itu kamu bisa menetapkan admin sekolah dari menu <span className="font-semibold text-slate-700">Admin Sekolah</span> dan mengatur role akun dari menu <span className="font-semibold text-slate-700">Role & Akun</span>.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_business</span>
                    Buat Sekolah Pertama
                  </button>
                </div>
              ) : (
                <div className="mt-6">
                  <AsyncTableCard
                    columns={columns}
                    dataState={dataState}
                    rowKey="id"
                    rowActions={(row) => (
                      <div className="flex justify-end gap-2">
                        <ActionIconButton icon="edit" label="Edit sekolah" onClick={() => openEditModal(row)} tone="primary" />
                        <ActionIconButton icon="vpn_key" label="Kelola kunci API sekolah" onClick={() => setApiKeyTarget(row)} tone="success" />
                        <ActionIconButton icon="delete" label="Hapus sekolah" onClick={() => setDeleteTarget(row)} tone="danger" />
                      </div>
                    )}
                    renderCell={(row, key) => {
                      if (key === "logo") {
                        return row.logo_url ? (
                          <img src={row.logo_url} alt={row.name} className="h-10 w-10 rounded-xl border border-slate-200 object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <span className="material-symbols-outlined text-[20px]">school</span>
                          </div>
                        );
                      }
                      if (key === "api_key_masked") {
                        return (
                          <button
                            type="button"
                            onClick={() => setApiKeyTarget(row)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <span className="material-symbols-outlined text-[16px]">vpn_key</span>
                            {row[key]}
                          </button>
                        );
                      }
                      if (key !== "status") return row[key];
                      return (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                          {String(row.status).toLowerCase()}
                        </span>
                      );
                    }}
                  />
                </div>
              )}
            </article>

            <aside className="space-y-4">
              <div className="rounded-3xl bg-white p-6 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Checklist Owner</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-sm font-semibold text-slate-900">1. Buat sekolah</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">Masukkan nama sekolah, NPSN, alamat, lalu simpan agar sekolah terdaftar di platform.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-sm font-semibold text-slate-900">2. Tetapkan admin sekolah</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">Gunakan menu <span className="font-semibold text-slate-700">Admin Sekolah</span> untuk menghubungkan akun admin ke sekolah yang benar.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-sm font-semibold text-slate-900">3. Aktifkan role akun</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">Gunakan menu <span className="font-semibold text-slate-700">Role & Akun</span> untuk review akun baru, aktivasi, atau blokir bila perlu.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-950 p-6 text-slate-100 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">API Key Sekolah</p>
                <h3 className="mt-2 text-lg font-semibold">Kelola hanya jika memang dipakai</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Kunci API sekolah tetap tersedia untuk kebutuhan integrasi. Jika tidak dipakai, cukup abaikan dan fokus ke aktivasi admin sekolah.
                </p>
              </div>
            </aside>
          </section>
        </>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
          <article className="overflow-hidden rounded-3xl bg-white shadow-card">
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Profil Sekolah</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{school?.name || "Sekolah belum terhubung"}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Admin hanya mengelola data sekolah miliknya, jadi halaman ini ditampilkan sebagai informasi profil sekolah.
                  </p>
                </div>
                {school ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(school)}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      Edit Profil
                    </button>
                    <button
                      type="button"
                      onClick={() => setApiKeyTarget(school)}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                    >
                      <span className="material-symbols-outlined text-[18px]">vpn_key</span>
                      Kelola API Key
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="p-6">
              {dataState.loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="rounded-2xl border border-slate-100 p-4">
                      <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                      <div className="mt-3 h-5 w-40 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : dataState.error ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {dataState.error}
                </div>
              ) : school ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama Sekolah</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{school.name || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logo Sekolah</p>
                    <div className="mt-2">
                      {school.logo_url ? (
                        <img src={school.logo_url} alt={school.name} className="h-14 w-14 rounded-xl border border-slate-200 object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                          <span className="material-symbols-outlined">school</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">NPSN</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{school.npsn || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alamat Sekolah</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{school.address || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                    <div className="mt-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(school.status)}`}>
                        {String(school.status || "-").toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">API Key</p>
                    <button
                      type="button"
                      onClick={() => setApiKeyTarget(school)}
                      className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <span className="material-symbols-outlined text-[16px]">vpn_key</span>
                      {school.api_key_masked}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                  Data sekolah untuk akun admin ini belum tersedia.
                </div>
              )}
            </div>
          </article>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-6 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Ruang Kerja Admin</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">Satu sekolah, satu scope kerja</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Semua data guru, siswa, kelas, mapel, ujian, dan jadwal pada dashboard admin ini otomatis terikat ke sekolah yang sama.
              </p>
            </div>

            <div className="rounded-3xl bg-slate-950 p-6 text-slate-100 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Integrasi</p>
              <h3 className="mt-2 text-lg font-semibold">Kunci API Sekolah</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Gunakan kunci API sekolah ini hanya untuk integrasi resmi. Pembuatan ulang kunci akan menonaktifkan kunci lama.
              </p>
              <button
                type="button"
                onClick={() => school && setApiKeyTarget(school)}
                disabled={!school}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">shield_lock</span>
                Lihat Detail API Key
              </button>
            </div>
          </aside>
        </section>
      )}

      <FormModal
        open={open}
        title={editingId ? "Edit Sekolah" : "Tambah Sekolah"}
        description="Perubahan akan langsung disimpan ke data sekolah pada sistem."
        submitLabel={editingId ? "Simpan Perubahan" : "Simpan Sekolah"}
        onSubmit={handleSave}
        onClose={() => {
          setOpen(false);
          setEditingId("");
          setForm(initialForm);
          setLogoFile(null);
          setLogoPreview("");
        }}
        submitting={submitting}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Logo sekolah</span>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt="Preview logo sekolah" className="h-16 w-16 rounded-2xl border border-slate-200 object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <span className="material-symbols-outlined">school</span>
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setLogoFile(file);
                    if (file) {
                      setLogoPreview(URL.createObjectURL(file));
                    } else {
                      setLogoPreview(form.logo_url || "");
                    }
                  }}
                />
                <span className="mt-1.5 block text-xs text-slate-500">Opsional. Jika tidak diupload, dashboard sekolah tetap memakai ikon bawaan.</span>
              </div>
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama sekolah</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Masukkan nama sekolah"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">NPSN</span>
            <input
              inputMode="numeric"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Masukkan NPSN"
              value={form.npsn}
              onChange={(event) => setForm((prev) => ({ ...prev, npsn: event.target.value }))}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Alamat sekolah</span>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              placeholder="Masukkan alamat sekolah"
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Status</span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Tidak aktif</option>
            </select>
          </label>
        </div>
      </FormModal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Sekolah"
        description={`Hapus sekolah ${deleteTarget?.name || ""}? Tindakan ini tidak dapat dibatalkan.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteSchool(deleteTarget.id);
            setDeleteTarget(null);
            await dataState.reload();
            showToast("Sekolah berhasil dihapus.");
          } catch (error) {
            setDeleteTarget(null);
            showToast(error.message, "error");
          }
        }}
      />

      <FormModal
        open={Boolean(apiKeyTarget)}
        title="Pengelolaan Kunci API"
        description={`Kelola kunci API sekolah untuk ${apiKeyTarget?.name || "sekolah"}.`}
        submitLabel="Buat Ulang Kunci API Sekolah"
        cancelLabel="Tutup"
        onSubmit={async () => {
          if (!apiKeyTarget) return;
          await handleRegenerate(apiKeyTarget.id);
          setApiKeyTarget(null);
        }}
        onClose={() => setApiKeyTarget(null)}
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kunci API saat ini</p>
            <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="break-all font-mono text-xs text-slate-800">
                {apiKeyLoading ? "Memuat kunci API sekolah..." : apiKeyValue || "-"}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCopyApiKey}
              disabled={apiKeyLoading || !apiKeyValue}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              Salin Kunci API Sekolah
            </button>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
            Proses pembuatan ulang akan menghasilkan kunci baru dan menonaktifkan kunci sebelumnya untuk integrasi sekolah ini.
          </div>
        </div>
      </FormModal>
    </>
  );
}
