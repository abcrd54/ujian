import { apiDelete, apiDownload, apiDownloadFile, apiGet, apiPost, apiPut } from "../lib/api";
import { hasSupabaseConfig } from "../lib/supabase";

const emptyDashboardSummary = {
  stats: [],
  activities: [],
  exams: [],
};

const emptySettings = {
  role: "-",
  school: {
    name: "-",
    npsn: "-",
    status: "-",
    address: "-",
  },
  security: {
    rls: false,
    rate_limit: false,
    api_key_masking: false,
  },
};

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function titleStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "-";
  if (raw === "approved") return "Disetujui";
  if (raw === "submitted") return "Menunggu";
  if (raw === "scheduled") return "Terjadwal";
  if (raw === "draft") return "Draf";
  if (raw === "rejected") return "Ditolak";
  if (raw === "reviewed") return "Sudah Ditinjau";
  if (raw === "review soal") return "Peninjauan Soal";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function maskApiKey(value) {
  if (!value) return "-";
  if (value.length <= 14) return value;
  return `${value.slice(0, 10)}....${value.slice(-4)}`;
}

async function safeFetch(fetcher, fallback) {
  if (!hasSupabaseConfig) return fallback;
  return fetcher();
}

export async function getDashboardSummary() {
  return safeFetch(async () => {
    const summary = await apiGet("/api/dashboard");
    if (summary.role === "owner") {
      const [schools, accounts] = await Promise.all([apiGet("/api/schools"), apiGet("/api/accounts")]);
      const schoolMap = new Map((schools || []).map((school) => [school.id, school]));
      const adminRows = (accounts || []).filter((item) => item.role === "admin");
      return {
        role: summary.role,
        stats: [
          { label: "Total Sekolah", value: String(summary.summary.total_schools || 0), icon: "apartment" },
          { label: "Admin Sekolah", value: String(summary.summary.total_admins || 0), icon: "admin_panel_settings" },
          { label: "Akun Pending", value: String(summary.summary.pending_profiles || 0), icon: "hourglass_top" },
          { label: "Sekolah Aktif", value: String(summary.summary.active_schools || 0), icon: "task_alt" },
        ],
        activities: [
          `${summary.summary.total_schools || 0} sekolah sudah terdaftar di platform.`,
          `${summary.summary.total_admins || 0} akun admin sekolah aktif atau sedang disiapkan.`,
          `${summary.summary.pending_profiles || 0} akun masih menunggu penetapan role/sekolah.`,
        ],
        tableColumns: [
          { key: "school_name", label: "Sekolah" },
          { key: "admin_name", label: "Admin Sekolah" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Dibuat" },
        ],
        rows: adminRows.map((item) => ({
          id: item.id,
          school_name: schoolMap.get(item.school_id)?.name || "Belum dipetakan",
          admin_name: item.full_name || item.email || "-",
          status: item.status || "-",
          created_at: formatDate(item.created_at),
        })),
      };
    }

    const [exams, results, teachers] = await Promise.all([
      apiGet("/api/exams"),
      apiGet("/api/results"),
      apiGet("/api/teachers"),
    ]);
    const teacherMap = new Map((teachers || []).map((item) => [item.profile_id || item.id, item.full_name]));
    const activeExams = (exams || []).filter((item) => String(item.status).toLowerCase() === "approved").length;
    const runningTasks = (exams || []).filter((item) =>
      ["draft", "submitted"].includes(String(item.status).toLowerCase()),
    ).length;
    return {
      role: summary.role,
      stats: [
        { label: "Total Guru", value: String(summary.summary.total_teachers || 0), icon: "person" },
        { label: "Total Siswa", value: String(summary.summary.total_students || 0), icon: "groups" },
        { label: "Total Kelas", value: String(summary.summary.total_classes || 0), icon: "meeting_room" },
        { label: "Total Ujian", value: String(summary.summary.total_exams || 0), icon: "description" },
        { label: "Ujian Aktif", value: String(activeExams), icon: "timer" },
        { label: "Tugas Berjalan", value: String(runningTasks), icon: "task_alt" },
      ],
      activities: [
        `Role aktif: ${summary.role}`,
        `${summary.summary.total_teachers || 0} guru terdaftar dalam scope akun ini.`,
        `${summary.summary.total_students || 0} siswa aktif dalam scope akun ini.`,
        `${(results || []).length} data hasil ujian tersedia.`,
      ],
      tableColumns: [
        { key: "title", label: "Ujian" },
        { key: "teacher", label: "Guru" },
        { key: "status", label: "Status" },
        { key: "schedule", label: "Jadwal" },
      ],
      rows: (exams || []).slice(0, 8).map((item) => ({
        id: item.id,
        title: item.title || "-",
        teacher: teacherMap.get(item.teacher_id) || item.teacher_id || "-",
        status: titleStatus(item.status),
        schedule: formatDate(item.created_at),
      })),
    };
  }, {
    ...emptyDashboardSummary,
  });
}

export async function getSchools() {
  return safeFetch(async () => {
    const rows = await apiGet("/api/schools");
    return (rows || []).map((row) => ({
      id: row.id,
      name: row.name || "-",
      npsn: row.npsn || "-",
      address: row.address || "-",
      status: row.status || "-",
      logo_url: row.logo_url || "",
      api_key_masked: maskApiKey(row.api_key),
    }));
  }, []);
}

export function createSchool(payload) {
  return apiPost("/api/schools", payload);
}

export function updateSchool(id, payload) {
  return apiPut(`/api/schools/${id}`, payload);
}

export function deleteSchool(id) {
  return apiDelete(`/api/schools/${id}`);
}

export function regenerateSchoolApiKey(id) {
  return apiPost(`/api/schools/${id}/regenerate-api-key`, {});
}

export function getSchoolApiKey(id) {
  return apiGet(`/api/schools/${id}/api-key`);
}

export function uploadSchoolLogo(id, file) {
  const formData = new FormData();
  formData.append("logo", file);
  return apiPost(`/api/schools/${id}/upload-logo`, formData);
}

export async function getTeachers() {
  return safeFetch(async () => {
    const rows = await apiGet("/api/teachers");
    return (rows || []).map((row) => ({
      id: row.id,
      profile_id: row.profile_id,
      school_id: row.school_id,
      nip: row.nip || "-",
      full_name: row.full_name || "-",
      email: row.email || "-",
      phone: row.phone || "-",
      status: row.status || "-",
    }));
  }, []);
}

export function createTeacher(payload) {
  return apiPost("/api/teachers", payload);
}

export function updateTeacher(id, payload) {
  return apiPut(`/api/teachers/${id}`, payload);
}

export function deleteTeacher(id) {
  return apiDelete(`/api/teachers/${id}`);
}

export function importTeachers(file, schoolId) {
  const formData = new FormData();
  formData.append("file", file);
  if (schoolId) formData.append("school_id", schoolId);
  return apiPost("/api/teachers/import", formData);
}

export async function getStudents() {
  return safeFetch(async () => {
    const [rows, classes] = await Promise.all([apiGet("/api/students"), apiGet("/api/classes")]);
    const classMap = new Map((classes || []).map((item) => [item.id, item.name]));
    return (rows || []).map((row) => ({
      id: row.id,
      school_id: row.school_id,
      class_id: row.class_id,
      nisn: row.nisn || "-",
      full_name: row.full_name || "-",
      username: row.username || "-",
      class_name: classMap.get(row.class_id) || row.class_id || "-",
      status: row.status || "-",
    }));
  }, []);
}

export function createStudent(payload) {
  return apiPost("/api/students", payload);
}

export function updateStudent(id, payload) {
  return apiPut(`/api/students/${id}`, payload);
}

export function deleteStudent(id) {
  return apiDelete(`/api/students/${id}`);
}

export function importStudents(file, schoolId) {
  const formData = new FormData();
  formData.append("file", file);
  if (schoolId) formData.append("school_id", schoolId);
  return apiPost("/api/students/import", formData);
}

export function generateStudentUsernames(schoolId) {
  return apiPost("/api/students/generate-usernames", schoolId ? { school_id: schoolId } : {});
}

export function resetStudentPassword(studentId, authUserId, newPassword) {
  return apiPost(`/api/students/${studentId}/reset-password`, {
    auth_user_id: authUserId,
    new_password: newPassword,
  });
}

export async function getClasses() {
  return safeFetch(async () => {
    const [rows, students] = await Promise.all([apiGet("/api/classes"), apiGet("/api/students")]);
    const counts = (students || []).reduce((acc, student) => {
      acc[student.class_id] = (acc[student.class_id] || 0) + 1;
      return acc;
    }, {});
    return (rows || []).map((row) => ({
      id: row.id,
      school_id: row.school_id,
      name: row.name || "-",
      major: row.major || "-",
      grade: row.grade || "-",
      students_count: counts[row.id] || 0,
    }));
  }, []);
}

export function createClass(payload) {
  return apiPost("/api/classes", payload);
}

export function updateClass(id, payload) {
  return apiPut(`/api/classes/${id}`, payload);
}

export function deleteClass(id) {
  return apiDelete(`/api/classes/${id}`);
}

export async function getSubjects() {
  return safeFetch(async () => {
    const [rows, classes, teachers] = await Promise.all([
      apiGet("/api/subjects"),
      apiGet("/api/classes"),
      apiGet("/api/teachers"),
    ]);
    const classMap = new Map((classes || []).map((item) => [item.id, item.name]));
    const teacherMap = new Map((teachers || []).map((item) => [item.profile_id || item.id, item.full_name]));
    return (rows || []).map((row) => ({
      id: row.id,
      school_id: row.school_id,
      code: row.code || "-",
      name: row.name || "-",
      class_name: classMap.get(row.class_id) || row.class_id || "-",
      teacher_name: teacherMap.get(row.teacher_id) || row.teacher_id || "-",
    }));
  }, []);
}

export function createSubject(payload) {
  return apiPost("/api/subjects", payload);
}

export function updateSubject(id, payload) {
  return apiPut(`/api/subjects/${id}`, payload);
}

export function deleteSubject(id) {
  return apiDelete(`/api/subjects/${id}`);
}

export async function getExams() {
  return safeFetch(async () => {
    const [rows, teachers, classes, subjects, bundles] = await Promise.all([
      apiGet("/api/exams"),
      apiGet("/api/teachers"),
      apiGet("/api/classes"),
      apiGet("/api/subjects"),
      apiGet("/api/exam-bundles").catch(() => []),
    ]);
    const teacherMap = new Map((teachers || []).map((item) => [item.profile_id || item.id, item.full_name]));
    const classMap = new Map((classes || []).map((item) => [item.id, item.name]));
    const subjectMap = new Map((subjects || []).map((item) => [item.id, item.name]));
    const bundleMap = new Map((bundles || []).map((item) => [item.id, item.title]));
    return (rows || []).map((row) => ({
      id: row.id,
      school_id: row.school_id,
      bundle_id: row.bundle_id || "",
      teacher_id: row.teacher_id,
      subject_id: row.subject_id,
      class_id: row.class_id,
      bundle_title: bundleMap.get(row.bundle_id) || "-",
      subject: subjectMap.get(row.subject_id) || row.subject_id || "-",
      class_name: classMap.get(row.class_id) || row.class_id || "-",
      title: row.title || "-",
      teacher: teacherMap.get(row.teacher_id) || row.teacher_id || "-",
      raw_status: row.status || "draft",
      status: titleStatus(row.status),
      schedule: formatDate(row.created_at),
      duration_minutes: row.duration_minutes,
      passing_grade: row.passing_grade,
      type: row.type,
    }));
  }, []);
}

export async function getExamBundles() {
  return safeFetch(async () => {
    const rows = await apiGet("/api/exam-bundles");
    return (rows || []).map((row) => ({
      id: row.id,
      school_id: row.school_id,
      title: row.title || "-",
      bundle_type: row.bundle_type || "-",
      academic_year: row.academic_year || "-",
      semester: row.semester || "-",
      status: row.status || "-",
      start_date: row.start_date,
      end_date: row.end_date,
      items_count: row.items_count || 0,
      participants_count: row.participants_count || 0,
      class_count: row.class_count || 0,
      subject_count: row.subject_count || 0,
      description: row.description || "",
    }));
  }, []);
}

export function getExamBundleDetail(id) {
  return apiGet(`/api/exam-bundles/${id}`);
}

export function createExamBundle(payload) {
  return apiPost("/api/exam-bundles", payload);
}

export function updateExamBundle(id, payload) {
  return apiPut(`/api/exam-bundles/${id}`, payload);
}

export function deleteExamBundle(id) {
  return apiDelete(`/api/exam-bundles/${id}`);
}

export function createExam(payload) {
  return apiPost("/api/exams", payload);
}

export function updateExam(id, payload) {
  return apiPut(`/api/exams/${id}`, payload);
}

export function deleteExam(id) {
  return apiDelete(`/api/exams/${id}`);
}

export function approveExam(id) {
  return apiPost(`/api/exams/${id}/approve`, {});
}

export function rejectExam(id) {
  return apiPost(`/api/exams/${id}/reject`, {});
}

export function submitExamQuestions(id) {
  return apiPost(`/api/exams/${id}/submit-questions`, {});
}

export async function getExamQuestions(examId) {
  return apiGet(`/api/exams/${examId}/questions`);
}

export function createExamQuestion(examId, payload) {
  return apiPost(`/api/exams/${examId}/questions`, payload);
}

export function updateExamQuestion(examId, questionId, payload) {
  return apiPut(`/api/exams/${examId}/questions/${questionId}`, payload);
}

export function deleteExamQuestion(examId, questionId) {
  return apiDelete(`/api/exams/${examId}/questions/${questionId}`);
}

export function syncExamQuestions(examId, questions) {
  return apiPost(`/api/exams/${examId}/questions/sync`, { questions });
}

export function importExamQuestions(examId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiPost(`/api/exams/${examId}/questions/import`, formData);
}

export function downloadExamQuestionTemplate() {
  return apiDownloadFile("/api/exams/questions/template", "template-import-soal.xlsx");
}

export async function uploadExamImage(examId, file, schoolId) {
  const formData = new FormData();
  formData.append("image", file);
  if (schoolId) formData.append("school_id", schoolId);
  return apiPost(`/api/exams/${examId}/upload-image`, formData);
}

export async function getTeacherTasks() {
  return safeFetch(async () => {
    const [exams, teachers] = await Promise.all([apiGet("/api/exams"), apiGet("/api/teachers")]);
    const teacherMap = new Map((teachers || []).map((item) => [item.profile_id || item.id, item.full_name]));
    return (exams || []).map((row) => ({
      id: row.id,
      exam: row.title || "-",
      teacher: teacherMap.get(row.teacher_id) || row.teacher_id || "-",
      deadline: formatDate(row.question_deadline),
      raw_status: row.status || "draft",
      progress:
        String(row.status).toLowerCase() === "approved"
          ? "Selesai"
          : String(row.status).toLowerCase() === "submitted"
            ? "Menunggu Review"
            : "Penyusunan",
    }));
  }, []);
}

export async function getReviewQuestions() {
  return safeFetch(async () => apiGet("/api/review-questions"), []);
}

export async function getSchedules() {
  return safeFetch(async () => {
    const [rows, exams, classes] = await Promise.all([
      apiGet("/api/exam-schedules"),
      apiGet("/api/exams"),
      apiGet("/api/classes"),
    ]);
    const examMap = new Map((exams || []).map((item) => [item.id, item.title]));
    const classMap = new Map((classes || []).map((item) => [item.id, item.name]));
    return (rows || []).map((row) => ({
      id: row.id,
      exam_id: row.exam_id,
      class_id: row.class_id,
      school_id: row.school_id,
      exam: examMap.get(row.exam_id) || row.exam_id || "-",
      class_name: classMap.get(row.class_id) || row.class_id || "-",
      raw_start_time: row.start_time || "",
      raw_end_time: row.end_time || "",
      raw_status: row.status || "scheduled",
      start_time: formatDate(row.start_time),
      end_time: formatDate(row.end_time),
      status: titleStatus(row.status),
    }));
  }, []);
}

export function createSchedule(payload) {
  return apiPost("/api/exam-schedules", payload);
}

export function updateSchedule(id, payload) {
  return apiPut(`/api/exam-schedules/${id}`, payload);
}

export function deleteSchedule(id) {
  return apiDelete(`/api/exam-schedules/${id}`);
}

export async function getResults(filters = {}) {
  return safeFetch(async () => {
    const params = new URLSearchParams();
    if (filters.bundle_id) params.set("bundle_id", filters.bundle_id);
    if (filters.exam_id) params.set("exam_id", filters.exam_id);
    if (filters.class_id) params.set("class_id", filters.class_id);
    const query = params.toString();
    const [rows, exams, students] = await Promise.all([
      apiGet(`/api/results${query ? `?${query}` : ""}`),
      apiGet("/api/exams"),
      apiGet("/api/students"),
    ]);
    const examMap = new Map((exams || []).map((item) => [item.id, item.title]));
    const bundleMap = new Map((exams || []).map((item) => [item.id, item.bundle_title || "-"]));
    const classMap = new Map((exams || []).map((item) => [item.id, item.class_name || "-"]));
    const subjectMap = new Map((exams || []).map((item) => [item.id, item.subject || "-"]));
    const studentMap = new Map((students || []).map((item) => [item.id, item.full_name]));
    return (rows || []).map((row) => ({
      id: row.id,
      bundle: bundleMap.get(row.exam_id) || "-",
      exam: examMap.get(row.exam_id) || row.exam_id || "-",
      subject: subjectMap.get(row.exam_id) || "-",
      class_name: classMap.get(row.exam_id) || "-",
      student_name: studentMap.get(row.student_id) || row.student_id || "-",
      average_score: row.final_score ?? 0,
      completed: row.submitted_at ? "Selesai" : "Belum",
      status: titleStatus(row.status),
    }));
  }, []);
}

export function exportResults(format, filters = {}) {
  const params = new URLSearchParams({ format });
  if (filters.bundle_id) params.set("bundle_id", filters.bundle_id);
  if (filters.exam_id) params.set("exam_id", filters.exam_id);
  if (filters.class_id) params.set("class_id", filters.class_id);
  return apiDownload(`/api/results/export?${params.toString()}`);
}

export async function getEssayAnswers() {
  return safeFetch(async () => apiGet("/api/essay-answers"), []);
}

export function gradeEssay(answerId, score) {
  return apiPost("/api/essay/grade", { answer_id: answerId, score });
}

export async function getApiIntegrationInfo() {
  return safeFetch(async () => {
    const rows = await apiGet("/api/schools");
    return (rows || []).map((row) => ({
      id: row.id,
      school_name: row.name || "-",
      school_id: row.id,
      api_key_masked: maskApiKey(row.api_key),
      status: row.status || "-",
    }));
  }, []);
}

export async function getSettings() {
  return safeFetch(async () => apiGet("/api/settings"), emptySettings);
}

export async function getAccounts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.role) params.set("role", filters.role);
  if (filters.school_id) params.set("school_id", filters.school_id);
  const query = params.toString();
  return safeFetch(async () => apiGet(`/api/accounts${query ? `?${query}` : ""}`), []);
}

export function updateAccount(id, payload) {
  return apiPut(`/api/accounts/${id}`, payload);
}

export function createSchoolAdmin(payload) {
  return apiPost("/api/accounts/admins", payload);
}

export function resetSchoolAdminPassword(id, newPassword) {
  return apiPost(`/api/accounts/${id}/reset-password`, { new_password: newPassword });
}
