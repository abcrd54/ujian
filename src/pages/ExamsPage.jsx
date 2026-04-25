import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionIconButton } from "../components/ActionIconButton";
import { AsyncTableCard } from "../components/AsyncTableCard";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  createExamBundle,
  deleteExamBundle,
  getClasses,
  getExamBundleDetail,
  getExamBundles,
  getExams,
  getSchools,
  getStudents,
  getSubjects,
  getTeachers,
  updateExamBundle,
} from "../services/dashboardService";
import { ConfirmModal } from "../ui/ConfirmModal";
import { FormModal } from "../ui/FormModal";
import { useToast } from "../ui/ToastContext";

const examColumns = [
  { key: "title", label: "Mapel Ujian" },
  { key: "bundle_title", label: "Bundle" },
  { key: "teacher", label: "Guru" },
  { key: "status", label: "Status" },
];

const bundleColumns = [
  { key: "title", label: "Bundle Ujian" },
  { key: "bundle_type_label", label: "Jenis" },
  { key: "academic_period", label: "Periode" },
  { key: "participants_summary", label: "Peserta" },
  { key: "items_summary", label: "Mapel/Kelas" },
  { key: "status_label", label: "Status" },
];

const statusClass = {
  Terjadwal: "bg-blue-50 text-blue-700",
  Menunggu: "bg-amber-50 text-amber-700",
  Draf: "bg-slate-100 text-slate-700",
  Disetujui: "bg-emerald-50 text-emerald-700",
  published: "bg-emerald-50 text-emerald-700",
  draft: "bg-slate-100 text-slate-700",
  inactive: "bg-amber-50 text-amber-700",
};

const bundleTypeOptions = [
  { value: "uts", label: "UTS" },
  { value: "uas", label: "UAS" },
  { value: "pat", label: "PAT" },
  { value: "pas", label: "PAS" },
  { value: "tryout", label: "Tryout" },
  { value: "custom", label: "Custom" },
];

const initialBundleForm = {
  title: "",
  bundle_type: "uts",
  academic_year: "2026/2027",
  semester: "gasal",
  description: "",
  status: "draft",
  start_date: "",
  end_date: "",
  school_id: "",
  student_ids: [],
  items: [],
};

function titleStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "-";
  if (raw === "approved") return "Disetujui";
  if (raw === "submitted") return "Menunggu";
  if (raw === "scheduled") return "Terjadwal";
  if (raw === "draft") return "Draf";
  if (raw === "published") return "Dipublikasikan";
  if (raw === "inactive") return "Nonaktif";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getBundleTypeLabel(value) {
  return bundleTypeOptions.find((item) => item.value === value)?.label || String(value || "-").toUpperCase();
}

function createEmptyBundleItem() {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    subject_id: "",
    class_id: "",
    teacher_id: "",
    duration_minutes: 90,
    passing_grade: 75,
    type: "mixed",
    question_deadline: "",
    status: "draft",
  };
}

function sortByLabel(rows, key) {
  return [...(rows || [])].sort((left, right) => String(left?.[key] || "").localeCompare(String(right?.[key] || "")));
}

function statusBadgeClass(status) {
  return statusClass[status] || statusClass[String(status || "").toLowerCase()] || "bg-slate-100 text-slate-700";
}

function normalizeBundleRow(row) {
  return {
    ...row,
    bundle_type_label: getBundleTypeLabel(row.bundle_type),
    academic_period: `${row.semester === "gasal" ? "Gasal" : "Genap"} ${row.academic_year || "-"}`,
    participants_summary: `${row.participants_count || 0} siswa`,
    items_summary: `${row.items_count || 0} mapel • ${row.class_count || 0} kelas`,
    status_label: titleStatus(row.status),
  };
}

function TeacherExamBoard() {
  const navigate = useNavigate();
  const dataState = useAsyncData(getExams);

  return (
    <AsyncTableCard
      columns={examColumns}
      dataState={dataState}
      rowKey="id"
      filterKey="status"
      filterOptions={[
        { label: "Draf", value: "draf" },
        { label: "Disetujui", value: "disetujui" },
        { label: "Menunggu", value: "menunggu" },
      ]}
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
          <ActionIconButton
            icon="post_add"
            label="Buka halaman penyusunan soal"
            onClick={() => navigate(`/question-authoring?examId=${row.id}`)}
            tone="success"
          />
        </div>
      )}
    />
  );
}

export function ExamsPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const isTeacher = role === "guru";
  const [editingId, setEditingId] = useState("");
  const [selectedBundleId, setSelectedBundleId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialBundleForm);

  const bundleFetcher = useCallback(async () => {
    const rows = await getExamBundles();
    return rows.map(normalizeBundleRow);
  }, []);
  const bundleDetailFetcher = useCallback(
    () => (selectedBundleId ? getExamBundleDetail(selectedBundleId) : Promise.resolve(null)),
    [selectedBundleId],
  );

  const bundleState = useAsyncData(bundleFetcher);
  const teachersState = useAsyncData(getTeachers);
  const subjectsState = useAsyncData(getSubjects);
  const classesState = useAsyncData(getClasses);
  const studentsState = useAsyncData(getStudents);
  const schoolsState = useAsyncData(getSchools);
  const detailState = useAsyncData(bundleDetailFetcher, [selectedBundleId]);

  const sortedTeachers = useMemo(() => sortByLabel(teachersState.rows, "full_name"), [teachersState.rows]);
  const sortedSubjects = useMemo(() => sortByLabel(subjectsState.rows, "name"), [subjectsState.rows]);
  const sortedClasses = useMemo(
    () =>
      [...(classesState.rows || [])].sort(
        (left, right) =>
          Number(left.grade || 0) - Number(right.grade || 0) ||
          String(left.name || "").localeCompare(String(right.name || "")),
      ),
    [classesState.rows],
  );
  const selectedClassIds = useMemo(
    () => [...new Set((form.items || []).map((item) => item.class_id).filter(Boolean))],
    [form.items],
  );
  const visibleStudents = useMemo(() => {
    const rows = studentsState.rows || [];
    if (!selectedClassIds.length) return [];
    return [...rows]
      .filter((student) => selectedClassIds.includes(student.class_id))
      .sort(
        (left, right) =>
          String(left.class_name || "").localeCompare(String(right.class_name || "")) ||
          String(left.full_name || "").localeCompare(String(right.full_name || "")),
      );
  }, [selectedClassIds, studentsState.rows]);

  useEffect(() => {
    const derivedStudentIds = visibleStudents.map((student) => student.id);
    setForm((previous) => {
      const currentIds = [...(previous.student_ids || [])].sort();
      const nextIds = [...derivedStudentIds].sort();
      if (currentIds.length === nextIds.length && currentIds.every((id, index) => id === nextIds[index])) {
        return previous;
      }
      return { ...previous, student_ids: derivedStudentIds };
    });
  }, [visibleStudents]);

  async function openCreateModal() {
    setEditingId("");
    setForm({ ...initialBundleForm, items: [createEmptyBundleItem()] });
    setBundleModalOpen(true);
  }

  async function openEditModal(row) {
    try {
      const detail = await getExamBundleDetail(row.id);
      setEditingId(row.id);
      setForm({
        title: detail.title || "",
        bundle_type: detail.bundle_type || "uts",
        academic_year: detail.academic_year || "",
        semester: detail.semester || "gasal",
        description: detail.description || "",
        status: detail.status || "draft",
        start_date: detail.start_date ? detail.start_date.slice(0, 16) : "",
        end_date: detail.end_date ? detail.end_date.slice(0, 16) : "",
        school_id: detail.school_id || "",
        student_ids: (detail.participants || []).filter((item) => item.selected).map((item) => item.id),
        items: (detail.items || []).map((item) => ({
          id: item.id,
          subject_id: item.subject_id || "",
          class_id: item.class_id || "",
          teacher_id: item.teacher_id || "",
          duration_minutes: item.duration_minutes || 90,
          passing_grade: item.passing_grade || 75,
          type: item.type || "mixed",
          question_deadline: item.question_deadline ? item.question_deadline.slice(0, 16) : "",
          status: item.status || "draft",
          title: item.title || "",
        })),
      });
      setBundleModalOpen(true);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function addBundleItem() {
    setForm((previous) => ({ ...previous, items: [...previous.items, createEmptyBundleItem()] }));
  }

  function updateBundleItem(index, key, value) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }));
  }

  function removeBundleItem(index) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function handleBundleSubmit() {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        student_ids: visibleStudents.map((student) => student.id),
        items: form.items.filter((item) => item.subject_id && item.class_id && item.teacher_id),
      };
      if (editingId) {
        await updateExamBundle(editingId, payload);
      } else {
        await createExamBundle(payload);
      }
      setBundleModalOpen(false);
      setForm(initialBundleForm);
      setEditingId("");
      await bundleState.reload();
      if (selectedBundleId) await detailState.reload();
      showToast(editingId ? "Bundle ujian berhasil diperbarui." : "Bundle ujian berhasil dibuat.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (isTeacher) {
    return (
      <>
        <PageHeader
          title="Data Ujian"
          description="Guru melihat daftar mapel ujian yang ditugaskan dari bundle ujian sekolah dan masuk ke ruang penyusunan soal dari sini."
          hideAction
        />
        <TeacherExamBoard />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Bundle Ujian"
        description="Buat satu paket ujian seperti UTS Gasal 2026, lalu tentukan mapel, kelas, dan guru pembuat soal. Peserta siswa akan mengikuti kelas yang dipilih."
        actionLabel="Buat Bundle Ujian"
        onAction={openCreateModal}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]">
        <div>
          <AsyncTableCard
            columns={bundleColumns}
            dataState={bundleState}
            rowKey="id"
            renderCell={(row, key) => {
              if (key !== "status_label") return row[key];
              return (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                  {row.status_label}
                </span>
              );
            }}
            rowActions={(row) => (
              <div className="flex justify-end gap-2">
                <ActionIconButton
                  icon="visibility"
                  label="Lihat detail bundle"
                  onClick={() => setSelectedBundleId(row.id)}
                  tone="success"
                />
                <ActionIconButton icon="edit" label="Edit bundle" onClick={() => openEditModal(row)} tone="primary" />
                <ActionIconButton icon="delete" label="Hapus bundle" onClick={() => setDeleteTarget(row)} tone="danger" />
              </div>
            )}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl bg-white p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Konsep Bundle</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Satu event, banyak mapel</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Admin tidak lagi membuat ujian satu per satu dari awal. Admin membuat satu bundle seperti UTS atau UAS, lalu item mapelnya dibagikan ke guru untuk penyusunan soal.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Detail Bundle</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{detailState.rows?.title || "Pilih bundle"}</h3>
              </div>
              {selectedBundleId ? (
                <button
                  type="button"
                  onClick={() => openEditModal({ id: selectedBundleId })}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Edit
                </button>
              ) : null}
            </div>

            {detailState.loading ? (
              <div className="mt-4 space-y-3">
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ) : detailState.rows?.items ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mapel Aktif</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{detailState.rows.items.length}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Peserta Dipilih</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{(detailState.rows.participants || []).filter((item) => item.selected).length}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{titleStatus(detailState.rows.status)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Item Mapel</p>
                  <div className="mt-3 space-y-3">
                    {detailState.rows.items.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                        <p className="font-semibold text-slate-900">{item.subject_name} • {item.class_name}</p>
                        <p className="mt-1 text-sm text-slate-600">Guru: {item.teacher_name} • Durasi: {item.duration_minutes} menit</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">
                Pilih bundle pada tabel untuk melihat detail peserta dan item mapel di sini.
              </div>
            )}
          </div>
        </aside>
      </section>

      <FormModal
        open={bundleModalOpen}
        title={editingId ? "Edit Bundle Ujian" : "Buat Bundle Ujian"}
        description="Tentukan periode ujian, mapel di dalam bundle, dan guru pembuat soal. Peserta akan otomatis mengikuti kelas yang dipilih."
        submitLabel={editingId ? "Simpan Perubahan" : "Simpan Bundle"}
        onSubmit={handleBundleSubmit}
        onClose={() => {
          setBundleModalOpen(false);
          setEditingId("");
          setForm(initialBundleForm);
        }}
        submitting={submitting}
        size="xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block xl:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama bundle</span>
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Contoh: UTS Gasal 2026" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Jenis bundle</span>
              <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.bundle_type} onChange={(e) => setForm((p) => ({ ...p, bundle_type: e.target.value }))}>
                {bundleTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Tahun ajaran</span>
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="2026/2027" value={form.academic_year} onChange={(e) => setForm((p) => ({ ...p, academic_year: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Semester</span>
              <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.semester} onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))}>
                <option value="gasal">Gasal</option>
                <option value="genap">Genap</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Status bundle</span>
              <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="draft">Draf</option>
                <option value="published">Dipublikasikan</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Mulai bundle</span>
              <input type="datetime-local" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Selesai bundle</span>
              <input type="datetime-local" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
            </label>
            {role === "owner" ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Sekolah</span>
                <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.school_id} onChange={(e) => setForm((p) => ({ ...p, school_id: e.target.value }))}>
                  <option value="">Pilih sekolah</option>
                  {schoolsState.rows.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block md:col-span-2 xl:col-span-3">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Deskripsi</span>
              <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={3} placeholder="Catatan bundle, aturan peserta, atau instruksi tambahan" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Item Mapel di Dalam Bundle</h3>
                <p className="mt-1 text-sm text-slate-500">Setiap baris akan menjadi ujian mapel yang nantinya dikerjakan guru dan dijadwalkan ke siswa.</p>
              </div>
              <button type="button" onClick={addBundleItem} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Tambah Mapel</button>
            </div>

            <div className="mt-4 space-y-4">
              {form.items.map((item, index) => (
                <div key={item.id || index} className="rounded-2xl border border-slate-100 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Item {index + 1}</p>
                    <button type="button" onClick={() => removeBundleItem(index)} className="text-sm font-semibold text-rose-600">Hapus</button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Mata pelajaran</span>
                      <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={item.subject_id} onChange={(e) => updateBundleItem(index, "subject_id", e.target.value)}>
                        <option value="">Pilih mapel</option>
                        {sortedSubjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Kelas</span>
                      <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={item.class_id} onChange={(e) => updateBundleItem(index, "class_id", e.target.value)}>
                        <option value="">Pilih kelas</option>
                        {sortedClasses.map((kelas) => (
                          <option key={kelas.id} value={kelas.id}>{kelas.name} {kelas.grade ? `(Kelas ${kelas.grade})` : ""}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Guru pembuat soal</span>
                      <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={item.teacher_id} onChange={(e) => updateBundleItem(index, "teacher_id", e.target.value)}>
                        <option value="">Pilih guru</option>
                        {sortedTeachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.profile_id || teacher.id}>{teacher.full_name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Tipe ujian</span>
                      <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={item.type} onChange={(e) => updateBundleItem(index, "type", e.target.value)}>
                        <option value="mixed">Campuran</option>
                        <option value="pg">Pilihan ganda</option>
                        <option value="essay">Esai</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Durasi</span>
                      <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={item.duration_minutes} onChange={(e) => updateBundleItem(index, "duration_minutes", Number(e.target.value))} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Nilai minimum</span>
                      <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={item.passing_grade} onChange={(e) => updateBundleItem(index, "passing_grade", Number(e.target.value))} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Deadline soal</span>
                      <input type="datetime-local" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={item.question_deadline} onChange={(e) => updateBundleItem(index, "question_deadline", e.target.value)} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Status item</span>
                      <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={item.status} onChange={(e) => updateBundleItem(index, "status", e.target.value)}>
                        <option value="draft">Draf</option>
                        <option value="submitted">Menunggu</option>
                        <option value="approved">Disetujui</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Peserta Siswa</h3>
                <p className="mt-1 text-sm text-slate-500">Peserta tidak dipilih manual. Sistem mengambil seluruh siswa aktif dari kelas yang dipilih pada item mapel.</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Terpilih: <span className="font-semibold text-slate-900">{form.student_ids.length}</span></div>
            </div>

              {visibleStudents.length ? (
                <div className="mt-4 grid max-h-72 grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
                  {visibleStudents.map((student) => (
                    <div key={student.id} className="rounded-2xl border border-slate-100 p-4">
                      <p className="text-sm font-semibold text-slate-900">{student.full_name}</p>
                      <p className="text-xs text-slate-500">{student.nisn} • {student.class_name}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">
                  Pilih minimal satu kelas pada item mapel agar daftar peserta otomatis muncul di sini.
                </div>
              )}
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Bundle Ujian"
        description={`Apakah Anda yakin ingin menghapus bundle ${deleteTarget?.title || ""}? Seluruh item ujian di dalam bundle juga akan terhapus.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteExamBundle(deleteTarget.id);
            if (selectedBundleId === deleteTarget.id) setSelectedBundleId("");
            setDeleteTarget(null);
            await bundleState.reload();
            showToast("Bundle ujian berhasil dihapus.");
          } catch (error) {
            setDeleteTarget(null);
            showToast(error.message, "error");
          }
        }}
      />
    </>
  );
}
