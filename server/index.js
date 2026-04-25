const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const { Parser } = require("json2csv");
require("dotenv").config();
const {
  auditLog,
  loginLimiter,
  publicLimiter,
  requireAuth,
  requireApiKey,
  requireRoles,
  resolveProfileByAuthUser,
} = require("./middlewares");
const { supabaseAdmin, supabaseAnon } = require("./supabaseAdmin");

const app = express();
const port = Number(process.env.PORT || 8787);
const upload = multer({ dest: path.join(os.tmpdir(), "edu-exam-uploads") });

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(publicLimiter);
app.use(auditLog);

function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeRole(role) {
  const value = String(role || "").toLowerCase();
  if (value === "owner" || value.includes("super_admin") || value.includes("superadmin")) {
    return "owner";
  }
  if (value.includes("admin")) return "admin";
  if (value.includes("guru") || value.includes("teacher")) return "guru";
  return "siswa";
}

function getActorRole(req) {
  return normalizeRole(req.profile?.role);
}

function isOwner(req) {
  return getActorRole(req) === "owner";
}

function getScopedSchoolId(req, explicitSchoolId) {
  if (isOwner(req)) {
    return explicitSchoolId || null;
  }
  return req.profile.school_id;
}

function applySchoolScope(query, req, column = "school_id", explicitSchoolId) {
  const schoolId = getScopedSchoolId(req, explicitSchoolId);
  if (!schoolId) {
    return query;
  }
  return query.eq(column, schoolId);
}

function requireSchoolIdForWrite(req, explicitSchoolId) {
  const schoolId = getScopedSchoolId(req, explicitSchoolId);
  if (!schoolId) {
    throw createError(400, "school_id wajib diisi.");
  }
  return schoolId;
}

async function fetchRowsByIds(table, ids, columns) {
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin.from(table).select(columns).in("id", ids);
  if (error) throw error;
  return data || [];
}

function dedupeIds(values) {
  return [...new Set((values || []).filter(Boolean))];
}

async function syncExamBundleStudents(bundleId, schoolId, studentIds) {
  const uniqueStudentIds = dedupeIds(studentIds);
  if (uniqueStudentIds.length) {
    const students = await fetchRowsByIds("students", uniqueStudentIds, "id,school_id");
    if (students.length !== uniqueStudentIds.length) {
      throw createError(400, "Sebagian siswa peserta tidak ditemukan.");
    }
    const invalidStudent = students.find((student) => student.school_id !== schoolId);
    if (invalidStudent) {
      throw createError(400, "Peserta siswa harus berasal dari sekolah yang sama.");
    }
  }

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("exam_bundle_students")
    .select("id,student_id")
    .eq("bundle_id", bundleId);
  if (existingError) throw existingError;

  const existingStudentIds = new Set((existingRows || []).map((row) => row.student_id));
  const deleteIds = (existingRows || [])
    .filter((row) => !uniqueStudentIds.includes(row.student_id))
    .map((row) => row.id);
  const insertRows = uniqueStudentIds
    .filter((studentId) => !existingStudentIds.has(studentId))
    .map((studentId) => ({
      id: crypto.randomUUID(),
      bundle_id: bundleId,
      student_id: studentId,
      created_at: nowIso(),
    }));

  if (deleteIds.length) {
    const { error } = await supabaseAdmin.from("exam_bundle_students").delete().in("id", deleteIds);
    if (error) throw error;
  }
  if (insertRows.length) {
    const { error } = await supabaseAdmin.from("exam_bundle_students").insert(insertRows);
    if (error) throw error;
  }
}

function normalizeBundleItemPayload(item, context) {
  const subjectName = context.subjectMap.get(item.subject_id) || "Mapel";
  const className = context.classMap.get(item.class_id) || "Kelas";
  return {
    id: item.id || crypto.randomUUID(),
    school_id: context.schoolId,
    bundle_id: context.bundleId,
    subject_id: item.subject_id || null,
    class_id: item.class_id || null,
    teacher_id: item.teacher_id || null,
    title: item.title || `${context.bundleTitle} - ${subjectName} - ${className}`,
    type: item.type || "mixed",
    duration_minutes: toNumber(item.duration_minutes, 90),
    total_pg: toNumber(item.total_pg, 0),
    total_essay: toNumber(item.total_essay, 0),
    passing_grade: toNumber(item.passing_grade, 75),
    shuffle_questions: Boolean(item.shuffle_questions),
    shuffle_answers: Boolean(item.shuffle_answers),
    status: item.status || context.defaultStatus || "draft",
    question_deadline: item.question_deadline || null,
    created_at: item.created_at || nowIso(),
  };
}

async function syncExamBundleItems(bundle, items) {
  const submittedItems = Array.isArray(items) ? items.filter((item) => item?.subject_id && item?.class_id) : [];
  const subjectIds = dedupeIds(submittedItems.map((item) => item.subject_id));
  const classIds = dedupeIds(submittedItems.map((item) => item.class_id));
  const teacherIds = dedupeIds(submittedItems.map((item) => item.teacher_id));

  const [subjects, classes, teachers, existingRows] = await Promise.all([
    fetchRowsByIds("subjects", subjectIds, "id,name,school_id"),
    fetchRowsByIds("classes", classIds, "id,name,school_id"),
    fetchRowsByIds("profiles", teacherIds, "id,school_id,role"),
    supabaseAdmin.from("exams").select("id").eq("bundle_id", bundle.id),
  ]);

  const subjectMap = new Map(subjects.map((item) => [item.id, item.name]));
  const classMap = new Map(classes.map((item) => [item.id, item.name]));
  const teacherMap = new Map(teachers.map((item) => [item.id, item]));
  const existingIds = new Set((existingRows.data || []).map((row) => row.id));

  if (subjects.length !== subjectIds.length || classes.length !== classIds.length) {
    throw createError(400, "Mapel atau kelas pada bundle tidak valid.");
  }
  const invalidTeacher = teacherIds.find((teacherId) => {
    const teacher = teacherMap.get(teacherId);
    return !teacher || teacher.school_id !== bundle.school_id || normalizeRole(teacher.role) !== "guru";
  });
  if (invalidTeacher) {
    throw createError(400, "Guru pembuat soal pada bundle tidak valid.");
  }

  const rows = submittedItems.map((item) =>
    normalizeBundleItemPayload(item, {
      schoolId: bundle.school_id,
      bundleId: bundle.id,
      bundleTitle: bundle.title,
      defaultStatus: bundle.status === "published" ? "approved" : "draft",
      subjectMap,
      classMap,
    }),
  );

  const incomingIds = new Set(rows.map((row) => row.id));
  const deleteIds = [...existingIds].filter((id) => !incomingIds.has(id));

  if (deleteIds.length) {
    const { error } = await supabaseAdmin.from("exams").delete().in("id", deleteIds);
    if (error) throw error;
  }
  if (rows.length) {
    const { error } = await supabaseAdmin.from("exams").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  const { data, error } = await supabaseAdmin
    .from("exams")
    .select("*")
    .eq("bundle_id", bundle.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getExamBundleDetail(req, bundleId) {
  let bundleQuery = supabaseAdmin.from("exam_bundles").select("*").eq("id", bundleId);
  bundleQuery = applySchoolScope(bundleQuery, req);
  const { data: bundle, error: bundleError } = await bundleQuery.maybeSingle();
  if (bundleError) throw bundleError;
  if (!bundle) throw createError(404, "Bundle ujian tidak ditemukan.");

  let itemQuery = supabaseAdmin.from("exams").select("*").eq("bundle_id", bundleId).order("created_at", { ascending: true });
  itemQuery = applySchoolScope(itemQuery, req);
  if (getActorRole(req) === "guru") {
    itemQuery = itemQuery.eq("teacher_id", req.profile.id);
  }
  const { data: items, error: itemsError } = await itemQuery;
  if (itemsError) throw itemsError;
  if (getActorRole(req) === "guru" && !(items || []).length) {
    throw createError(404, "Bundle ujian tidak ditemukan.");
  }

  const [students, classes, subjects, teachers, participantRows] = await Promise.all([
    supabaseAdmin.from("students").select("id,full_name,class_id").eq("school_id", bundle.school_id),
    supabaseAdmin.from("classes").select("id,name").eq("school_id", bundle.school_id),
    supabaseAdmin.from("subjects").select("id,name").eq("school_id", bundle.school_id),
    supabaseAdmin.from("profiles").select("id,full_name").eq("school_id", bundle.school_id),
    supabaseAdmin.from("exam_bundle_students").select("student_id").eq("bundle_id", bundleId),
  ]);
  if (students.error) throw students.error;
  if (classes.error) throw classes.error;
  if (subjects.error) throw subjects.error;
  if (teachers.error) throw teachers.error;
  if (participantRows.error) throw participantRows.error;

  const classMap = new Map((classes.data || []).map((row) => [row.id, row.name]));
  const subjectMap = new Map((subjects.data || []).map((row) => [row.id, row.name]));
  const teacherMap = new Map((teachers.data || []).map((row) => [row.id, row.full_name]));
  const participantIdSet = new Set((participantRows.data || []).map((row) => row.student_id));

  return {
    ...bundle,
    items: (items || []).map((item) => ({
      ...item,
      subject_name: subjectMap.get(item.subject_id) || "-",
      class_name: classMap.get(item.class_id) || "-",
      teacher_name: teacherMap.get(item.teacher_id) || "-",
    })),
    participants: (students.data || []).map((student) => ({
      id: student.id,
      full_name: student.full_name,
      class_id: student.class_id,
      class_name: classMap.get(student.class_id) || "-",
      selected: participantIdSet.has(student.id),
    })),
  };
}

async function ensureStudentEligibleForExam(studentId, examId) {
  const { data: exam, error: examError } = await supabaseAdmin
    .from("exams")
    .select("id,school_id,bundle_id")
    .eq("id", examId)
    .maybeSingle();
  if (examError || !exam) throw createError(404, "Ujian tidak ditemukan.");
  if (!exam.bundle_id) return exam;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("exam_bundle_students")
    .select("id")
    .eq("bundle_id", exam.bundle_id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) {
    throw createError(403, "Siswa tidak terdaftar sebagai peserta pada bundle ujian ini.");
  }
  return exam;
}

async function getScopedResultRows(req, filters = {}) {
  const role = getActorRole(req);
  const { bundle_id, exam_id, class_id } = filters;
  let examsQuery = supabaseAdmin.from("exams").select("id,teacher_id,bundle_id,class_id");
  examsQuery = applySchoolScope(examsQuery, req);
  if (role === "guru") {
    examsQuery = examsQuery.eq("teacher_id", req.profile.id);
  }
  if (bundle_id) {
    examsQuery = examsQuery.eq("bundle_id", bundle_id);
  }
  if (exam_id) {
    examsQuery = examsQuery.eq("id", exam_id);
  }
  if (class_id) {
    examsQuery = examsQuery.eq("class_id", class_id);
  }

  const { data: exams, error: examsError } = await examsQuery;
  if (examsError) throw examsError;
  const examIds = (exams || []).map((exam) => exam.id);
  if (!examIds.length) return [];

  let query = supabaseAdmin
    .from("exam_sessions")
    .select("id,exam_id,student_id,status,final_score,submitted_at")
    .in("exam_id", examIds)
    .order("submitted_at", { ascending: false });
  const { data: rows, error } = await query;
  if (error) throw error;
  return rows || [];
}

async function ensureTeacherAccessToExam(req, examId) {
  const role = getActorRole(req);
  let query = supabaseAdmin.from("exams").select("id,school_id,teacher_id").eq("id", examId);
  query = applySchoolScope(query, req);
  const { data: exam, error } = await query.maybeSingle();
  if (error) throw error;
  if (!exam) throw createError(404, "Ujian tidak ditemukan.");
  if (role === "guru" && exam.teacher_id !== req.profile.id) {
    throw createError(403, "Guru hanya boleh mengakses ujian miliknya.");
  }
  return exam;
}

async function ensureAnswerGradeAccess(req, answerId) {
  const role = getActorRole(req);
  const { data: answer, error } = await supabaseAdmin
    .from("student_answers")
    .select("id,session_id")
    .eq("id", answerId)
    .maybeSingle();
  if (error) throw error;
  if (!answer) throw createError(404, "Jawaban tidak ditemukan.");

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("exam_sessions")
    .select("id,exam_id")
    .eq("id", answer.session_id)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) throw createError(404, "Session jawaban tidak ditemukan.");

  const exam = await ensureTeacherAccessToExam(req, session.exam_id);
  if (role === "guru" && exam.teacher_id !== req.profile.id) {
    throw createError(403, "Guru hanya boleh mengoreksi ujian miliknya.");
  }
  return answer;
}

function nowIso() {
  return new Date().toISOString();
}

function generateApiKey() {
  return `sk_sch_${crypto.randomBytes(18).toString("hex")}`;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safelyDeleteFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_error) {
    // ignore temp file cleanup failure
  }
}

function normalizeQuestionSequence(rows) {
  return (rows || []).map((row, index) => ({
    ...row,
    order_number: index + 1,
  }));
}

function normalizeQuestionImportRow(row, examId, teacherId, index) {
  const questionType = String(row.question_type || row.tipe || "pg").trim().toLowerCase() === "essay" ? "essay" : "pg";
  return {
    id: crypto.randomUUID(),
    exam_id: examId,
    teacher_id: teacherId || null,
    question_type: questionType,
    question_text: String(row.question_text || row.pertanyaan || "").trim() || null,
    image_url: String(row.image_url || row.gambar || "").trim() || null,
    option_a: String(row.option_a || "").trim() || null,
    option_b: String(row.option_b || "").trim() || null,
    option_c: String(row.option_c || "").trim() || null,
    option_d: String(row.option_d || "").trim() || null,
    option_e: String(row.option_e || "").trim() || null,
    correct_answer: String(row.correct_answer || row.jawaban_benar || "").trim().toUpperCase() || null,
    rubric_answer: String(row.rubric_answer || row.rubrik_jawaban || "").trim() || null,
    score_weight: toNumber(row.score_weight || row.bobot_nilai, 1),
    explanation: String(row.explanation || row.penjelasan || "").trim() || null,
    order_number: toNumber(row.order_number || row.nomor_urut, index + 1),
    created_at: nowIso(),
  };
}

function normalizeQuestionPayload(row, examId, teacherId, index) {
  const inputId = String(row.id || "").trim();
  const generatedId =
    inputId && !inputId.startsWith("local-") && !inputId.startsWith("__local")
      ? inputId
      : crypto.randomUUID();
  const questionType = String(row.question_type || "pg").trim().toLowerCase() === "essay" ? "essay" : "pg";
  return {
    id: generatedId,
    exam_id: examId,
    teacher_id: teacherId || null,
    question_type: questionType,
    question_text: String(row.question_text || "").trim() || null,
    image_url: String(row.image_url || "").trim() || null,
    option_a: String(row.option_a || "").trim() || null,
    option_b: String(row.option_b || "").trim() || null,
    option_c: String(row.option_c || "").trim() || null,
    option_d: String(row.option_d || "").trim() || null,
    option_e: String(row.option_e || "").trim() || null,
    correct_answer: String(row.correct_answer || "").trim().toUpperCase() || null,
    rubric_answer: String(row.rubric_answer || "").trim() || null,
    score_weight: toNumber(row.score_weight, 1),
    explanation: String(row.explanation || "").trim() || null,
    order_number: toNumber(row.order_number, index + 1),
    created_at: row.created_at || nowIso(),
  };
}

async function fromTable(table, queryBuilder) {
  const query = queryBuilder(supabaseAdmin.from(table));
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function countTable(table, eqField, eqValue) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(eqField, eqValue);
  if (error) throw error;
  return count || 0;
}

async function getStudentContext(studentId) {
  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("id,school_id,class_id,status")
    .eq("id", studentId)
    .maybeSingle();
  if (error || !student) throw createError(404, "Data siswa tidak ditemukan.");
  if (String(student.status || "").toLowerCase() !== "active") {
    throw createError(403, "Akun siswa tidak aktif.");
  }
  return student;
}

async function getSchedule(scheduleId) {
  const { data, error } = await supabaseAdmin
    .from("exam_schedules")
    .select("id,exam_id,school_id,class_id,start_time,end_time,status")
    .eq("id", scheduleId)
    .maybeSingle();
  if (error || !data) throw createError(404, "Jadwal ujian tidak ditemukan.");
  return data;
}

async function submitStudentSession(sessionId, studentId) {
  if (!sessionId) throw createError(400, "session_id wajib diisi.");

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("exam_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (sessionError || !session) throw createError(404, "Session tidak ditemukan.");

  const { data: schedule } = await supabaseAdmin
    .from("exam_schedules")
    .select("end_time")
    .eq("id", session.schedule_id)
    .maybeSingle();
  if (schedule && new Date() > new Date(schedule.end_time) && !session.submitted_at) {
    // auto submit by timeout
  }

  const { data: answers, error: answersError } = await supabaseAdmin
    .from("student_answers")
    .select("id,question_id,selected_option")
    .eq("session_id", sessionId);
  if (answersError) throw answersError;

  const { data: questions, error: questionError } = await supabaseAdmin
    .from("exam_questions")
    .select("id,question_type,correct_answer,score_weight")
    .eq("exam_id", session.exam_id);
  if (questionError) throw questionError;

  const questionMap = new Map((questions || []).map((q) => [q.id, q]));
  let totalScore = 0;
  for (const ans of answers || []) {
    const q = questionMap.get(ans.question_id);
    if (!q) continue;
    if (q.question_type === "pg") {
      const isCorrect =
        String(ans.selected_option || "").toUpperCase() ===
        String(q.correct_answer || "").toUpperCase();
      const score = isCorrect ? toNumber(q.score_weight, 1) : 0;
      totalScore += score;
      await supabaseAdmin.from("student_answers").update({ is_correct: isCorrect, score }).eq("id", ans.id);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("exam_sessions")
    .update({ submitted_at: nowIso(), status: "submitted", final_score: totalScore })
    .eq("id", sessionId)
    .eq("student_id", studentId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function saveStudentAnswer(body, studentId) {
  const { session_id, question_id } = body || {};
  if (!session_id || !question_id) throw createError(400, "session_id dan question_id wajib.");
  const { data: session } = await supabaseAdmin
    .from("exam_sessions")
    .select("id,student_id,status,exam_id,schedule_id")
    .eq("id", session_id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!session) throw createError(404, "Session tidak valid.");
  if (session.status === "submitted") throw createError(409, "Session sudah disubmit.");

  const { data: question, error: questionError } = await supabaseAdmin
    .from("exam_questions")
    .select("id,exam_id")
    .eq("id", question_id)
    .eq("exam_id", session.exam_id)
    .maybeSingle();
  if (questionError || !question) {
    throw createError(403, "Soal tidak sesuai dengan ujian pada session ini.");
  }

  const schedule = await getSchedule(session.schedule_id);
  if (new Date() > new Date(schedule.end_time)) {
    await submitStudentSession(session_id, studentId);
    throw createError(409, "Waktu ujian habis, session sudah di-submit otomatis.");
  }

  const payload = {
    id: body.id || crypto.randomUUID(),
    session_id,
    question_id,
    student_id: studentId,
    answer_text: body.answer_text || null,
    selected_option: body.selected_option || null,
    is_correct: null,
    score: 0,
    graded_by: null,
    graded_at: null,
  };
  const { data, error } = await supabaseAdmin
    .from("student_answers")
    .upsert(payload, { onConflict: "session_id,question_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, server_time: nowIso() });
});

app.get("/api/public/schools", async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("schools")
      .select("id,name,npsn,status,logo_url")
      .eq("status", "active")
      .order("name", { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw createError(400, "Email dan password wajib diisi.");

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw createError(401, error?.message || "Login gagal.");

    const profile = await resolveProfileByAuthUser(data.user);
    if (!profile) throw createError(403, "Profil user belum terdaftar.");

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email },
      profile: {
        id: profile.id,
        school_id: profile.school_id,
        full_name: profile.full_name,
        role: normalizeRole(profile.role),
        status: profile.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/student/login", loginLimiter, async (req, res, next) => {
  try {
    const { username, nisn, password, school_id } = req.body || {};
    const identity = String(username || nisn || "").trim();
    if (!identity || !password) {
      throw createError(400, "username/NISN dan password wajib diisi.");
    }

    let query = supabaseAdmin
      .from("students")
      .select("id,school_id,username,nisn,status")
      .or(`username.eq.${identity},nisn.eq.${identity}`);
    if (school_id) query = query.eq("school_id", school_id);
    const { data: student, error: studentError } = await query.maybeSingle();
    if (studentError || !student) throw createError(404, "Siswa tidak ditemukan.");
    if (String(student.status || "").toLowerCase() !== "active") {
      throw createError(403, "Akun siswa tidak aktif.");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,school_id,status")
      .eq("id", student.id)
      .maybeSingle();
    if (profileError || !profile?.email) {
      throw createError(403, "Profil Auth siswa belum terhubung.");
    }
    if (normalizeRole(profile.role) !== "siswa") {
      throw createError(403, "Akun bukan role siswa.");
    }
    if (String(profile.status || "").toLowerCase() !== "active") {
      throw createError(403, "Profil siswa tidak aktif.");
    }
    if (profile.school_id !== student.school_id) {
      throw createError(403, "Profil siswa tidak sinkron dengan sekolah siswa.");
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email: profile.email,
      password,
    });
    if (error || !data.session) throw createError(401, error?.message || "Login siswa gagal.");

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email },
      profile: {
        id: profile.id,
        school_id: profile.school_id,
        full_name: profile.full_name,
        role: normalizeRole(profile.role),
        status: profile.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/student/profile", requireAuth, requireRoles("siswa"), async (req, res, next) => {
  try {
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id,full_name,nisn,class_id,school_id,status,username")
      .eq("id", req.profile.id)
      .maybeSingle();
    if (studentError || !student) throw createError(404, "Profil siswa tidak ditemukan.");

    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("id,name")
      .eq("id", student.school_id)
      .maybeSingle();
    res.json({
      id: student.id,
      full_name: student.full_name,
      nisn: student.nisn,
      username: student.username,
      class_id: student.class_id,
      school_id: student.school_id,
      school_name: school?.name || null,
      status: student.status,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", requireAuth, async (req, res, next) => {
  try {
    const role = normalizeRole(req.profile.role);
    const schoolId = req.profile.school_id;
    const countAll = async (table) => {
      const { count, error } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    };
    if (role === "owner") {
      const [schools, admins, pendingProfiles, activeSchools] = await Promise.all([
        countAll("schools"),
        supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin"),
        supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabaseAdmin
          .from("schools")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
      ]);
      if (admins.error) throw admins.error;
      if (pendingProfiles.error) throw pendingProfiles.error;
      if (activeSchools.error) throw activeSchools.error;
      return res.json({
        summary: {
          total_schools: schools,
          total_admins: admins.count || 0,
          pending_profiles: pendingProfiles.count || 0,
          active_schools: activeSchools.count || 0,
        },
        role,
      });
    }

    const [teachers, students, classes, exams] = await Promise.all(
      [
        countTable("teachers", "school_id", schoolId),
        countTable("students", "school_id", schoolId),
        countTable("classes", "school_id", schoolId),
        countTable("exams", "school_id", schoolId),
      ],
    );
    res.json({
      summary: {
        total_teachers: teachers,
        total_students: students,
        total_classes: classes,
        total_exams: exams,
      },
      role,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/accounts", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    if (!isOwner(req)) throw createError(403, "Hanya owner yang bisa mengelola akun lintas sekolah.");
    let query = supabaseAdmin
      .from("profiles")
      .select("id,school_id,full_name,email,phone,role,status,created_at")
      .order("created_at", { ascending: false });
    if (req.query.role) {
      query = query.eq("role", String(req.query.role));
    }
    if (req.query.school_id) {
      query = query.eq("school_id", String(req.query.school_id));
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/accounts/admins", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    if (!isOwner(req)) throw createError(403, "Hanya owner yang bisa membuat admin sekolah.");

    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();
    const fullName = String(req.body.full_name || "").trim();
    const schoolId = String(req.body.school_id || "").trim();
    const phone = String(req.body.phone || "").trim() || null;

    if (!fullName) throw createError(400, "Nama lengkap admin wajib diisi.");
    if (!email) throw createError(400, "Email admin wajib diisi.");
    if (!password || password.length < 6) {
      throw createError(400, "Password admin minimal 6 karakter.");
    }
    if (!schoolId) throw createError(400, "Sekolah admin wajib dipilih.");

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("id,name")
      .eq("id", schoolId)
      .maybeSingle();
    if (schoolError) throw schoolError;
    if (!school) throw createError(404, "Sekolah tidak ditemukan.");

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;
    if (existingProfile) throw createError(409, "Email admin sudah terdaftar.");

    const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "admin",
        school_id: schoolId,
        phone,
      },
    });
    if (userError) throw createError(400, userError.message || "Gagal membuat user admin.");

    const authUser = userResult.user;
    if (!authUser?.id) throw createError(500, "User admin tidak berhasil dibuat.");

    const profilePayload = {
      id: authUser.id,
      school_id: schoolId,
      full_name: fullName,
      email,
      phone,
      role: "admin",
      status: "active",
    };

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });
    if (profileError) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      } catch (_cleanupError) {
        // ignore cleanup failure
      }
      throw profileError;
    }

    res.status(201).json({
      id: authUser.id,
      school_id: schoolId,
      school_name: school.name,
      full_name: fullName,
      email,
      phone,
      role: "admin",
      status: "active",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/accounts/:id/reset-password", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    if (!isOwner(req)) throw createError(403, "Hanya owner yang bisa mereset password admin sekolah.");
    const newPassword = String(req.body.new_password || "").trim();
    if (!newPassword || newPassword.length < 6) {
      throw createError(400, "Password baru minimal 6 karakter.");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,role,full_name,email")
      .eq("id", req.params.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw createError(404, "Akun admin tidak ditemukan.");
    if (normalizeRole(profile.role) !== "admin") {
      throw createError(400, "Reset password di halaman ini hanya untuk akun admin sekolah.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, {
      password: newPassword,
    });
    if (error) throw createError(400, error.message || "Gagal mereset password admin.");

    res.json({
      message: "Password admin sekolah berhasil direset.",
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/accounts/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    if (!isOwner(req)) throw createError(403, "Hanya owner yang bisa mengubah role akun.");
    const payload = {
      full_name: req.body.full_name,
      phone: req.body.phone,
      role: req.body.role,
      status: req.body.status,
      school_id: req.body.role === "owner" ? null : req.body.school_id,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    const nextRole = payload.role;
    const nextStatus = payload.status;
    if (nextRole && !["owner", "admin", "guru", "siswa"].includes(String(nextRole))) {
      throw createError(400, "Role akun tidak valid.");
    }
    if (nextStatus && !["pending", "active", "inactive", "blocked"].includes(String(nextStatus))) {
      throw createError(400, "Status akun tidak valid.");
    }
    if (payload.role && payload.role !== "owner" && payload.school_id == null) {
      throw createError(400, "Akun selain owner wajib memiliki sekolah.");
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(payload)
      .eq("id", req.params.id)
      .select("id,school_id,full_name,email,phone,role,status,created_at")
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/schools", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const role = normalizeRole(req.profile.role);
    const rows = await fromTable("schools", (q) =>
      role === "owner" ? q.select("*").order("created_at", { ascending: false }) : q.select("*").eq("id", req.profile.school_id),
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/schools", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    if (!isOwner(req)) throw createError(403, "Hanya owner yang bisa menambah sekolah.");
    const payload = {
      id: req.body.id || crypto.randomUUID(),
      name: req.body.name || null,
      address: req.body.address || null,
      npsn: req.body.npsn || null,
      logo_url: req.body.logo_url || null,
      api_key: generateApiKey(),
      status: req.body.status || "active",
      created_at: nowIso(),
    };
    const { data, error } = await supabaseAdmin.from("schools").insert(payload).select("*").single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.put("/api/schools/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const payload = {
      name: req.body.name,
      address: req.body.address,
      npsn: req.body.npsn,
      logo_url: req.body.logo_url,
      status: req.body.status,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    let query = supabaseAdmin.from("schools").update(payload).eq("id", req.params.id);
    query = applySchoolScope(query, req, "id", req.params.id);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/schools/:id/upload-logo",
  requireAuth,
  requireRoles("admin"),
  upload.single("logo"),
  async (req, res, next) => {
    try {
      if (!req.file) throw createError(400, "File logo wajib diupload.");
      let schoolQuery = supabaseAdmin.from("schools").select("id,name").eq("id", req.params.id);
      schoolQuery = applySchoolScope(schoolQuery, req, "id", req.params.id);
      const { data: school, error: schoolError } = await schoolQuery.maybeSingle();
      if (schoolError) throw schoolError;
      if (!school) throw createError(404, "Sekolah tidak ditemukan.");

      const bucket = process.env.SUPABASE_SCHOOL_LOGO_BUCKET || "school-logos";
      const ext = path.extname(req.file.originalname || ".png");
      const objectName = `${req.params.id}/${crypto.randomUUID()}${ext}`;
      const fileBuffer = fs.readFileSync(req.file.path);
      const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(objectName, fileBuffer, {
        upsert: false,
        contentType: req.file.mimetype || "image/png",
      });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectName);
      const logoUrl = publicData.publicUrl;
      const { data, error } = await supabaseAdmin
        .from("schools")
        .update({ logo_url: logoUrl })
        .eq("id", req.params.id)
        .select("*")
        .single();
      if (error) throw error;

      fs.unlinkSync(req.file.path);
      res.json({
        id: data.id,
        name: data.name,
        logo_url: data.logo_url,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/schools/:id/api-key", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("schools").select("id,name,api_key").eq("id", req.params.id);
    query = applySchoolScope(query, req, "id", req.params.id);
    const { data, error } = await query.single();
    if (error) throw error;
    res.json({
      id: data.id,
      name: data.name,
      api_key: data.api_key,
      masked_api_key: `${data.api_key.slice(0, 10)}....${data.api_key.slice(-4)}`,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/schools/:id/regenerate-api-key", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from("schools")
      .update({ api_key: generateApiKey() })
      .eq("id", req.params.id);
    query = applySchoolScope(query, req, "id", req.params.id);
    const { data, error } = await query.select("id,name,api_key").single();
    if (error) throw error;
    res.json({
      id: data.id,
      name: data.name,
      api_key: data.api_key,
      masked_api_key: `${data.api_key.slice(0, 10)}....${data.api_key.slice(-4)}`,
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/schools/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    if (!isOwner(req)) throw createError(403, "Hanya owner yang bisa menghapus sekolah.");
    const { error } = await supabaseAdmin.from("schools").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ message: "Sekolah berhasil dihapus." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/teachers", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    const rows = await fromTable("teachers", (q) => applySchoolScope(q.select("*"), req));
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/teachers", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const schoolId = requireSchoolIdForWrite(req, req.body.school_id);
    const payload = {
      id: req.body.id || crypto.randomUUID(),
      school_id: schoolId,
      profile_id: req.body.profile_id || null,
      nip: req.body.nip || null,
      full_name: req.body.full_name || null,
      email: req.body.email || null,
      phone: req.body.phone || null,
      status: req.body.status || "active",
    };
    const { data, error } = await supabaseAdmin.from("teachers").insert(payload).select("*").single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.put("/api/teachers/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const payload = {
      profile_id: req.body.profile_id,
      nip: req.body.nip,
      full_name: req.body.full_name,
      email: req.body.email,
      phone: req.body.phone,
      status: req.body.status,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    let query = supabaseAdmin.from("teachers").update(payload).eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/teachers/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("teachers").delete().eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { error } = await query;
    if (error) throw error;
    res.json({ message: "Guru berhasil dihapus." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/teachers/import", requireAuth, requireRoles("admin"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw createError(400, "File Excel wajib diupload.");
    const schoolId = requireSchoolIdForWrite(req, req.body.school_id);
    const workbook = XLSX.readFile(req.file.path);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet);
    const inserts = rows.map((r) => ({
      id: crypto.randomUUID(),
      school_id: schoolId,
      nip: String(r.nip || r.NIP || "").trim(),
      full_name: String(r.full_name || r.nama || "").trim(),
      email: String(r.email || "").trim(),
      phone: String(r.phone || r.hp || "").trim(),
      status: "active",
    }));
    const { error } = await supabaseAdmin.from("teachers").insert(inserts);
    if (error) throw error;
    fs.unlinkSync(req.file.path);
    res.json({ inserted: inserts.length });
  } catch (error) {
    next(error);
  }
});

app.get("/api/students", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    const rows = await fromTable("students", (q) => applySchoolScope(q.select("*"), req));
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/students", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const schoolId = requireSchoolIdForWrite(req, req.body.school_id);
    const username =
      req.body.username ||
      String(req.body.full_name || "siswa")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 12) +
        String(Date.now()).slice(-4);

    const payload = {
      id: req.body.id || crypto.randomUUID(),
      school_id: schoolId,
      class_id: req.body.class_id || null,
      nisn: req.body.nisn || null,
      full_name: req.body.full_name || null,
      username,
      status: req.body.status || "active",
    };
    const { data, error } = await supabaseAdmin.from("students").insert(payload).select("*").single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.put("/api/students/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const payload = {
      class_id: req.body.class_id,
      nisn: req.body.nisn,
      full_name: req.body.full_name,
      username: req.body.username,
      status: req.body.status,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    let query = supabaseAdmin.from("students").update(payload).eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/students/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("students").delete().eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { error } = await query;
    if (error) throw error;
    res.json({ message: "Siswa berhasil dihapus." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/students/import", requireAuth, requireRoles("admin"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw createError(400, "File Excel wajib diupload.");
    const schoolId = requireSchoolIdForWrite(req, req.body.school_id);
    const workbook = XLSX.readFile(req.file.path);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet);
    const inserts = rows.map((r) => ({
      id: crypto.randomUUID(),
      school_id: schoolId,
      class_id: r.class_id || null,
      nisn: String(r.nisn || r.NISN || "").trim(),
      full_name: String(r.full_name || r.nama || "").trim(),
      username:
        String(r.username || "")
          .trim()
          .toLowerCase() ||
        String(r.nisn || "").trim(),
      status: "active",
    }));
    const { error } = await supabaseAdmin.from("students").insert(inserts);
    if (error) throw error;
    fs.unlinkSync(req.file.path);
    res.json({ inserted: inserts.length });
  } catch (error) {
    next(error);
  }
});

app.post("/api/students/generate-usernames", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("students").select("id, nisn");
    query = applySchoolScope(query, req, "school_id", req.body.school_id);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data || []) {
      await supabaseAdmin
        .from("students")
        .update({ username: `s${String(row.nisn || row.id).slice(-8)}` })
        .eq("id", row.id);
    }
    res.json({ updated: (data || []).length });
  } catch (error) {
    next(error);
  }
});

app.post("/api/students/:id/reset-password", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const { auth_user_id, new_password } = req.body || {};
    if (!new_password) {
      throw createError(400, "new_password wajib diisi.");
    }
    let studentQuery = supabaseAdmin.from("students").select("id, school_id").eq("id", req.params.id);
    studentQuery = applySchoolScope(studentQuery, req);
    const { data: student, error: studentError } = await studentQuery.maybeSingle();
    if (studentError) throw studentError;
    if (!student) throw createError(404, "Siswa tidak ditemukan atau di luar scope.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(auth_user_id || student.id, {
      password: new_password,
    });
    if (error) throw error;
    res.json({ message: "Password siswa berhasil direset." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/classes", requireAuth, async (req, res, next) => {
  try {
    const rows = await fromTable("classes", (q) => applySchoolScope(q.select("*"), req));
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/classes", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const schoolId = requireSchoolIdForWrite(req, req.body.school_id);
    const payload = {
      id: req.body.id || crypto.randomUUID(),
      school_id: schoolId,
      name: req.body.name || null,
      major: req.body.major || null,
      grade: req.body.grade || null,
    };
    const { data, error } = await supabaseAdmin.from("classes").insert(payload).select("*").single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.put("/api/classes/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const payload = {
      name: req.body.name,
      major: req.body.major,
      grade: req.body.grade,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    let query = supabaseAdmin.from("classes").update(payload).eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/classes/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("classes").delete().eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { error } = await query;
    if (error) throw error;
    res.json({ message: "Kelas berhasil dihapus." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/subjects", requireAuth, async (req, res, next) => {
  try {
    const rows = await fromTable("subjects", (q) => applySchoolScope(q.select("*"), req));
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/subjects", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const schoolId = requireSchoolIdForWrite(req, req.body.school_id);
    const payload = {
      id: req.body.id || crypto.randomUUID(),
      school_id: schoolId,
      teacher_id: req.body.teacher_id || null,
      code: req.body.code || null,
      name: req.body.name || null,
      class_id: req.body.class_id || null,
    };
    const { data, error } = await supabaseAdmin.from("subjects").insert(payload).select("*").single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.put("/api/subjects/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const payload = {
      teacher_id: req.body.teacher_id,
      code: req.body.code,
      name: req.body.name,
      class_id: req.body.class_id,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    let query = supabaseAdmin.from("subjects").update(payload).eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/subjects/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("subjects").delete().eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { error } = await query;
    if (error) throw error;
    res.json({ message: "Mapel berhasil dihapus." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/exam-bundles", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    let bundleQuery = applySchoolScope(
      supabaseAdmin.from("exam_bundles").select("*").order("created_at", { ascending: false }),
      req,
    );
    const { data: bundles, error: bundleError } = await bundleQuery;
    if (bundleError) throw bundleError;
    if (!(bundles || []).length) return res.json([]);

    const bundleIds = (bundles || []).map((bundle) => bundle.id);
    const [{ data: items, error: itemsError }, { data: participants, error: participantsError }] =
      await Promise.all([
        supabaseAdmin.from("exams").select("id,bundle_id,teacher_id,subject_id,class_id").in("bundle_id", bundleIds),
        supabaseAdmin.from("exam_bundle_students").select("bundle_id,student_id").in("bundle_id", bundleIds),
      ]);
    if (itemsError) throw itemsError;
    if (participantsError) throw participantsError;

    const role = getActorRole(req);
    const filteredBundles =
      role === "guru"
        ? (bundles || []).filter((bundle) =>
            (items || []).some((item) => item.bundle_id === bundle.id && item.teacher_id === req.profile.id),
          )
        : bundles || [];

    res.json(
      filteredBundles.map((bundle) => {
        const bundleItems = (items || []).filter(
          (item) => item.bundle_id === bundle.id && (role !== "guru" || item.teacher_id === req.profile.id),
        );
        const classCount = new Set(bundleItems.map((item) => item.class_id).filter(Boolean)).size;
        const subjectCount = new Set(bundleItems.map((item) => item.subject_id).filter(Boolean)).size;
        return {
          ...bundle,
          items_count: bundleItems.length,
          participants_count: (participants || []).filter((row) => row.bundle_id === bundle.id).length,
          class_count: classCount,
          subject_count: subjectCount,
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/exam-bundles/:id", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    const detail = await getExamBundleDetail(req, req.params.id);
    res.json(detail);
  } catch (error) {
    next(error);
  }
});

app.post("/api/exam-bundles", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const schoolId = requireSchoolIdForWrite(req, req.body.school_id);
    const payload = {
      id: req.body.id || crypto.randomUUID(),
      school_id: schoolId,
      title: req.body.title || null,
      bundle_type: req.body.bundle_type || "uts",
      academic_year: req.body.academic_year || null,
      semester: req.body.semester || "gasal",
      description: req.body.description || null,
      status: req.body.status || "draft",
      start_date: req.body.start_date || null,
      end_date: req.body.end_date || null,
      created_at: nowIso(),
    };
    const { data: bundle, error } = await supabaseAdmin.from("exam_bundles").insert(payload).select("*").single();
    if (error) throw error;

    await syncExamBundleStudents(bundle.id, schoolId, req.body.student_ids || []);
    const items = await syncExamBundleItems(bundle, req.body.items || []);
    res.status(201).json({ ...bundle, items_count: items.length, participants_count: (req.body.student_ids || []).length });
  } catch (error) {
    next(error);
  }
});

app.put("/api/exam-bundles/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let bundleQuery = supabaseAdmin.from("exam_bundles").select("*").eq("id", req.params.id);
    bundleQuery = applySchoolScope(bundleQuery, req);
    const { data: existingBundle, error: existingError } = await bundleQuery.maybeSingle();
    if (existingError) throw existingError;
    if (!existingBundle) throw createError(404, "Bundle ujian tidak ditemukan.");

    const payload = {
      title: req.body.title,
      bundle_type: req.body.bundle_type,
      academic_year: req.body.academic_year,
      semester: req.body.semester,
      description: req.body.description,
      status: req.body.status,
      start_date: req.body.start_date,
      end_date: req.body.end_date,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    let updateQuery = supabaseAdmin.from("exam_bundles").update(payload).eq("id", req.params.id);
    updateQuery = applySchoolScope(updateQuery, req);
    const { data: bundle, error } = await updateQuery.select("*").single();
    if (error) throw error;

    await syncExamBundleStudents(bundle.id, bundle.school_id, req.body.student_ids || []);
    const items = await syncExamBundleItems(bundle, req.body.items || []);
    res.json({ ...bundle, items_count: items.length, participants_count: (req.body.student_ids || []).length });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/exam-bundles/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let bundleQuery = supabaseAdmin.from("exam_bundles").delete().eq("id", req.params.id);
    bundleQuery = applySchoolScope(bundleQuery, req);
    const { error } = await bundleQuery;
    if (error) throw error;
    res.json({ message: "Bundle ujian berhasil dihapus." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/exams", requireAuth, async (req, res, next) => {
  try {
    let query = applySchoolScope(supabaseAdmin.from("exams").select("*"), req);
    if (getActorRole(req) === "guru") {
      query = query.eq("teacher_id", req.profile.id);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

app.get("/api/review-questions", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    let examsQuery = applySchoolScope(
      supabaseAdmin.from("exams").select("id,title,status,teacher_id"),
      req,
    );
    if (getActorRole(req) === "guru") {
      examsQuery = examsQuery.eq("teacher_id", req.profile.id);
    }
    const { data: exams, error: examsError } = await examsQuery.order("created_at", { ascending: false });
    if (examsError) throw examsError;

    const examIds = (exams || []).map((exam) => exam.id);
    if (!examIds.length) return res.json([]);

    const [{ data: questions, error: questionsError }, { data: teachers, error: teachersError }] = await Promise.all([
      supabaseAdmin
        .from("exam_questions")
        .select("exam_id,question_type")
        .in("exam_id", examIds),
      supabaseAdmin.from("profiles").select("id,full_name"),
    ]);
    if (questionsError) throw questionsError;
    if (teachersError) throw teachersError;

    const teacherMap = new Map((teachers || []).map((item) => [item.id, item.full_name]));
    const questionMap = new Map();
    for (const question of questions || []) {
      const current = questionMap.get(question.exam_id) || { pg_count: 0, essay_count: 0 };
      if (question.question_type === "essay") current.essay_count += 1;
      else current.pg_count += 1;
      questionMap.set(question.exam_id, current);
    }

    res.json(
      (exams || []).map((exam) => {
        const counts = questionMap.get(exam.id) || { pg_count: 0, essay_count: 0 };
        return {
          exam_id: exam.id,
          exam: exam.title,
          submitted_by: teacherMap.get(exam.teacher_id) || "-",
          pg_count: counts.pg_count,
          essay_count: counts.essay_count,
          status:
            exam.status === "approved"
              ? "Approved"
              : exam.status === "rejected"
                ? "Rejected"
              : exam.status === "submitted"
                  ? "Pending"
                  : "Draft",
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/exams", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const schoolId = requireSchoolIdForWrite(req, req.body.school_id);
      const payload = {
        id: req.body.id || crypto.randomUUID(),
        school_id: schoolId,
        bundle_id: req.body.bundle_id || null,
        subject_id: req.body.subject_id || null,
        class_id: req.body.class_id || null,
        teacher_id: req.body.teacher_id || null,
      title: req.body.title || null,
      type: req.body.type || "mixed",
      duration_minutes: toNumber(req.body.duration_minutes, 90),
      total_pg: toNumber(req.body.total_pg, 0),
      total_essay: toNumber(req.body.total_essay, 0),
      passing_grade: toNumber(req.body.passing_grade, 75),
      shuffle_questions: Boolean(req.body.shuffle_questions),
      shuffle_answers: Boolean(req.body.shuffle_answers),
      status: req.body.status || "draft",
      question_deadline: req.body.question_deadline || null,
      created_at: nowIso(),
    };
    const { data, error } = await supabaseAdmin.from("exams").insert(payload).select("*").single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.put("/api/exams/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
      const payload = {
        bundle_id: req.body.bundle_id,
        subject_id: req.body.subject_id,
        class_id: req.body.class_id,
        teacher_id: req.body.teacher_id,
      title: req.body.title,
      type: req.body.type,
      duration_minutes: req.body.duration_minutes,
      total_pg: req.body.total_pg,
      total_essay: req.body.total_essay,
      passing_grade: req.body.passing_grade,
      shuffle_questions: req.body.shuffle_questions,
      shuffle_answers: req.body.shuffle_answers,
      status: req.body.status,
      question_deadline: req.body.question_deadline,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    let query = supabaseAdmin.from("exams").update(payload).eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/exams/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("exams").delete().eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { error } = await query;
    if (error) throw error;
    res.json({ message: "Ujian berhasil dihapus." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/exams/:id", requireAuth, async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("exams").select("*").eq("id", req.params.id);
    query = applySchoolScope(query, req);
    if (getActorRole(req) === "guru") {
      query = query.eq("teacher_id", req.profile.id);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) throw createError(404, "Ujian tidak ditemukan.");
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/exams/:id/questions", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    await ensureTeacherAccessToExam(req, req.params.id);
    const { data, error } = await supabaseAdmin
      .from("exam_questions")
      .select("*")
      .eq("exam_id", req.params.id)
      .order("order_number", { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

app.get("/api/exams/questions/template", requireAuth, requireRoles("admin", "guru"), async (_req, res, next) => {
  try {
    const workbook = XLSX.utils.book_new();
    const rows = [
      {
        order_number: 1,
        question_type: "pg",
        question_text: "Ibukota Indonesia adalah ...",
        image_url: "",
        option_a: "Bandung",
        option_b: "Jakarta",
        option_c: "Surabaya",
        option_d: "Medan",
        option_e: "Makassar",
        correct_answer: "B",
        rubric_answer: "",
        score_weight: 1,
        explanation: "Jakarta adalah ibu kota Indonesia.",
      },
      {
        order_number: 2,
        question_type: "essay",
        question_text: "Jelaskan pengertian fotosintesis.",
        image_url: "",
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        option_e: "",
        correct_answer: "",
        rubric_answer: "Menjelaskan proses tumbuhan mengubah cahaya menjadi energi.",
        score_weight: 5,
        explanation: "",
      },
    ];
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Template Soal");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="template-import-soal.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

app.post("/api/exams/:id/questions", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    await ensureTeacherAccessToExam(req, req.params.id);
    const payload = {
      id: crypto.randomUUID(),
      exam_id: req.params.id,
      teacher_id: req.profile.id,
      question_type: req.body.question_type || "pg",
      question_text: req.body.question_text || null,
      image_url: req.body.image_url || null,
      option_a: req.body.option_a || null,
      option_b: req.body.option_b || null,
      option_c: req.body.option_c || null,
      option_d: req.body.option_d || null,
      option_e: req.body.option_e || null,
      correct_answer: req.body.correct_answer || null,
      rubric_answer: req.body.rubric_answer || null,
      score_weight: toNumber(req.body.score_weight, 1),
      explanation: req.body.explanation || null,
      order_number: toNumber(req.body.order_number, 1),
      created_at: nowIso(),
    };
    const { data, error } = await supabaseAdmin
      .from("exam_questions")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/exams/:id/questions/import",
  requireAuth,
  requireRoles("admin", "guru"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const exam = await ensureTeacherAccessToExam(req, req.params.id);
      if (!req.file) throw createError(400, "File Excel wajib diupload.");
      const workbook = XLSX.readFile(req.file.path);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet);

      const { data: existingQuestions, error: existingError } = await supabaseAdmin
        .from("exam_questions")
        .select("order_number")
        .eq("exam_id", req.params.id);
      if (existingError) throw existingError;
      const baseOrder = (existingQuestions || []).reduce(
        (max, item) => Math.max(max, Number(item.order_number) || 0),
        0,
      );

      const inserts = rows
        .map((row, index) => {
          const normalized = normalizeQuestionImportRow(row, req.params.id, exam.teacher_id, index);
          normalized.order_number = baseOrder + index + 1;
          return normalized;
        })
        .filter((row) => row.question_text);
      if (!inserts.length) {
        throw createError(400, "Tidak ada soal valid yang bisa diimpor.");
      }
      const { data: insertedRows, error } = await supabaseAdmin
        .from("exam_questions")
        .insert(inserts)
        .select("*")
        .order("order_number", { ascending: true });
      if (error) throw error;
      safelyDeleteFile(req.file.path);
      res.json({ inserted: inserts.length, start_order: baseOrder + 1, rows: insertedRows || [] });
    } catch (error) {
      safelyDeleteFile(req.file?.path);
      next(error);
    }
  },
);

app.post("/api/exams/:id/questions/sync", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    const exam = await ensureTeacherAccessToExam(req, req.params.id);
    const submittedRows = Array.isArray(req.body?.questions) ? req.body.questions : [];
    const normalizedRows = normalizeQuestionSequence(
      submittedRows
      .map((row, index) => normalizeQuestionPayload(row || {}, req.params.id, exam.teacher_id, index))
      .filter((row) => row.question_text),
    );

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("exam_questions")
      .select("id")
      .eq("exam_id", req.params.id);
    if (existingError) throw existingError;

    const incomingIds = new Set(normalizedRows.map((row) => row.id));
    const deleteIds = (existingRows || [])
      .map((row) => row.id)
      .filter((id) => !incomingIds.has(id));

    if (deleteIds.length) {
      const { error: deleteError } = await supabaseAdmin
        .from("exam_questions")
        .delete()
        .eq("exam_id", req.params.id)
        .in("id", deleteIds);
      if (deleteError) throw deleteError;
    }

    if (normalizedRows.length) {
      const { error: upsertError } = await supabaseAdmin
        .from("exam_questions")
        .upsert(normalizedRows, { onConflict: "id" });
      if (upsertError) throw upsertError;
    } else {
      const { error: clearError } = await supabaseAdmin
        .from("exam_questions")
        .delete()
        .eq("exam_id", req.params.id);
      if (clearError) throw clearError;
    }

    const { data, error } = await supabaseAdmin
      .from("exam_questions")
      .select("*")
      .eq("exam_id", req.params.id)
      .order("order_number", { ascending: true });
    if (error) throw error;
    res.json({ saved: normalizedRows.length, rows: data || [] });
  } catch (error) {
    next(error);
  }
});

app.put(
  "/api/exams/:id/questions/:questionId",
  requireAuth,
  requireRoles("admin", "guru"),
  async (req, res, next) => {
    try {
      await ensureTeacherAccessToExam(req, req.params.id);
      const payload = {
        question_type: req.body.question_type,
        question_text: req.body.question_text,
        image_url: req.body.image_url,
        option_a: req.body.option_a,
        option_b: req.body.option_b,
        option_c: req.body.option_c,
        option_d: req.body.option_d,
        option_e: req.body.option_e,
        correct_answer: req.body.correct_answer,
        rubric_answer: req.body.rubric_answer,
        score_weight: req.body.score_weight,
        explanation: req.body.explanation,
        order_number: req.body.order_number,
      };
      Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
      const { data, error } = await supabaseAdmin
        .from("exam_questions")
        .update(payload)
        .eq("id", req.params.questionId)
        .eq("exam_id", req.params.id)
        .select("*")
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  "/api/exams/:id/questions/:questionId",
  requireAuth,
  requireRoles("admin", "guru"),
  async (req, res, next) => {
    try {
      await ensureTeacherAccessToExam(req, req.params.id);
      const { error } = await supabaseAdmin
        .from("exam_questions")
        .delete()
        .eq("id", req.params.questionId)
        .eq("exam_id", req.params.id);
      if (error) throw error;
      res.json({ message: "Soal berhasil dihapus." });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/exams/:id/upload-image",
  requireAuth,
  requireRoles("admin", "guru"),
  upload.single("image"),
  async (req, res, next) => {
    try {
      await ensureTeacherAccessToExam(req, req.params.id);
      if (!req.file) throw createError(400, "File image wajib diupload.");
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || "exam-images";
      const ext = path.extname(req.file.originalname || ".png");
      const schoolPath = getScopedSchoolId(req, req.body.school_id) || "global";
      const objectName = `${schoolPath}/${req.params.id}/${crypto.randomUUID()}${ext}`;
      const fileBuffer = fs.readFileSync(req.file.path);
      const { error } = await supabaseAdmin.storage.from(bucket).upload(objectName, fileBuffer, {
        upsert: false,
        contentType: req.file.mimetype || "image/png",
      });
      if (error) throw error;
      const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectName);
      safelyDeleteFile(req.file.path);
      res.json({ image_url: data.publicUrl });
    } catch (error) {
      safelyDeleteFile(req.file?.path);
      next(error);
    }
  },
);

app.get("/api/integration/schools/me", requireApiKey, async (req, res, next) => {
  try {
    res.json({
      school: {
        id: req.school.id,
        name: req.school.name,
        status: req.school.status,
      },
      integration: {
        authenticated: true,
        method: "api_key",
      },
      server_time: nowIso(),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/exams/:id/submit-questions", requireAuth, requireRoles("guru"), async (req, res, next) => {
  try {
    await ensureTeacherAccessToExam(req, req.params.id);
    const { error } = await supabaseAdmin
      .from("exams")
      .update({ status: "submitted" })
      .eq("id", req.params.id)
      .eq("teacher_id", req.profile.id);
    if (error) throw error;
    res.json({ message: "Soal berhasil dikirim ke admin." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/exams/:id/approve", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("exams").update({ status: "approved" }).eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { error } = await query;
    if (error) throw error;
    res.json({ message: "Soal ujian disetujui." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/exams/:id/reject", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("exams").update({ status: "rejected" }).eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { error } = await query;
    if (error) throw error;
    res.json({ message: "Soal ujian ditolak dan dikembalikan ke guru." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/exam-schedules", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const schoolId = requireSchoolIdForWrite(req, req.body.school_id);
    const payload = {
      id: crypto.randomUUID(),
      exam_id: req.body.exam_id,
      school_id: schoolId,
      class_id: req.body.class_id,
      start_time: req.body.start_time,
      end_time: req.body.end_time,
      status: req.body.status || "scheduled",
    };
    const { data, error } = await supabaseAdmin
      .from("exam_schedules")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/exam-schedules", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    const rows = await fromTable("exam_schedules", (q) =>
      applySchoolScope(q.select("*"), req).order("start_time", { ascending: true }),
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/exam-schedules/:id", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("exam_schedules").select("*").eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) throw createError(404, "Jadwal ujian tidak ditemukan.");
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.put("/api/exam-schedules/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const payload = {
      exam_id: req.body.exam_id,
      class_id: req.body.class_id,
      start_time: req.body.start_time,
      end_time: req.body.end_time,
      status: req.body.status,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    let query = supabaseAdmin.from("exam_schedules").update(payload).eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/exam-schedules/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("exam_schedules").delete().eq("id", req.params.id);
    query = applySchoolScope(query, req);
    const { error } = await query;
    if (error) throw error;
    res.json({ message: "Jadwal ujian berhasil dihapus." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/student/exams", requireAuth, requireRoles("siswa"), async (req, res, next) => {
  try {
    const student = await getStudentContext(req.profile.id);

    const rows = await fromTable("exam_schedules", (q) =>
      q
        .select("id,exam_id,class_id,start_time,end_time,status")
        .eq("school_id", student.school_id)
        .eq("class_id", student.class_id)
        .order("start_time", { ascending: true }),
    );
    const examIds = dedupeIds(rows.map((row) => row.exam_id));
    const exams = await fetchRowsByIds("exams", examIds, "id,bundle_id");
    const examMap = new Map(exams.map((exam) => [exam.id, exam]));
    const bundleIds = dedupeIds(exams.map((exam) => exam.bundle_id));
    let membershipSet = new Set();
    if (bundleIds.length) {
      const { data: memberships, error: membershipError } = await supabaseAdmin
        .from("exam_bundle_students")
        .select("bundle_id")
        .in("bundle_id", bundleIds)
        .eq("student_id", student.id);
      if (membershipError) throw membershipError;
      membershipSet = new Set((memberships || []).map((item) => item.bundle_id));
    }

    res.json(
      rows.filter((row) => {
        const exam = examMap.get(row.exam_id);
        return !exam?.bundle_id || membershipSet.has(exam.bundle_id);
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/student/exams/:examId", requireAuth, requireRoles("siswa"), async (req, res, next) => {
  try {
    const student = await getStudentContext(req.profile.id);
    const { examId } = req.params;
    await ensureStudentEligibleForExam(student.id, examId);
    const { data: exam, error: examError } = await supabaseAdmin.from("exams").select("*").eq("id", examId).maybeSingle();
    if (examError || !exam) throw createError(404, "Ujian tidak ditemukan.");
    if (exam.school_id !== student.school_id) throw createError(403, "Ujian bukan milik sekolah siswa.");

    const { data: schedules } = await supabaseAdmin
      .from("exam_schedules")
      .select("*")
      .eq("exam_id", examId)
      .eq("school_id", student.school_id)
      .eq("class_id", student.class_id)
      .order("start_time", { ascending: true });
    if (!(schedules || []).length) {
      throw createError(403, "Ujian tidak dijadwalkan untuk kelas siswa.");
    }

    res.json({ ...exam, schedules: schedules || [] });
  } catch (error) {
    next(error);
  }
});

app.post("/api/student/exam-sessions/start", requireAuth, requireRoles("siswa"), async (req, res, next) => {
  try {
    const { exam_id, schedule_id } = req.body || {};
    if (!exam_id || !schedule_id) {
      throw createError(400, "exam_id dan schedule_id wajib.");
    }

    const studentId = req.profile.id;
    const student = await getStudentContext(studentId);
    const schedule = await getSchedule(schedule_id);
    if (schedule.school_id !== student.school_id) {
      throw createError(403, "Jadwal tidak valid untuk sekolah siswa.");
    }
    if (schedule.class_id !== student.class_id) throw createError(403, "Jadwal bukan untuk kelas siswa.");
    if (schedule.exam_id !== exam_id) throw createError(403, "exam_id tidak cocok dengan jadwal.");

    const exam = await ensureStudentEligibleForExam(student.id, exam_id);
    if (exam.school_id !== student.school_id) {
      throw createError(403, "Ujian tidak valid untuk sekolah siswa.");
    }

    const { data: existingSession } = await supabaseAdmin
      .from("exam_sessions")
      .select("id,status,submitted_at")
      .eq("exam_id", exam_id)
      .eq("schedule_id", schedule_id)
      .eq("student_id", studentId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingSession?.submitted_at || existingSession?.status === "submitted") {
      throw createError(409, "Ujian sudah pernah disubmit.");
    }
    if (existingSession) return res.json(existingSession);

    const now = new Date();
    const start = new Date(schedule.start_time);
    const end = new Date(schedule.end_time);
    if (now < start) throw createError(403, "Ujian belum dimulai.");
    if (now > end) throw createError(403, "Waktu ujian sudah habis.");

    const payload = {
      id: crypto.randomUUID(),
      exam_id,
      student_id: studentId,
      schedule_id,
      started_at: nowIso(),
      status: "started",
      final_score: 0,
    };
    const { data, error } = await supabaseAdmin.from("exam_sessions").insert(payload).select("*").single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/student/exam-sessions/:sessionId/questions",
  requireAuth,
  requireRoles("siswa"),
  async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const { data: session, error: sessionError } = await supabaseAdmin
        .from("exam_sessions")
        .select("id,exam_id,student_id,status,submitted_at,schedule_id")
        .eq("id", sessionId)
        .eq("student_id", req.profile.id)
        .maybeSingle();
      if (sessionError || !session) throw createError(404, "Session tidak ditemukan.");
      const schedule = await getSchedule(session.schedule_id);
      if (!session.submitted_at && new Date() > new Date(schedule.end_time)) {
        await submitStudentSession(session.id, req.profile.id);
      }

      const { data: questions, error: questionsError } = await supabaseAdmin
        .from("exam_questions")
        .select(
          "id,exam_id,question_type,question_text,image_url,option_a,option_b,option_c,option_d,option_e,order_number",
        )
        .eq("exam_id", session.exam_id)
        .order("order_number", { ascending: true });
      if (questionsError) throw questionsError;

      const { data: answers } = await supabaseAdmin
        .from("student_answers")
        .select("question_id,selected_option,answer_text")
        .eq("session_id", sessionId)
        .eq("student_id", req.profile.id);
      const answerMap = new Map((answers || []).map((a) => [a.question_id, a]));

      res.json({
        session,
        questions: (questions || []).map((q) => ({
          ...q,
          student_answer: answerMap.get(q.id) || null,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

app.post("/api/student/answers/save", requireAuth, requireRoles("siswa"), async (req, res, next) => {
  try {
    const data = await saveStudentAnswer(req.body, req.profile.id);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/student/answers", requireAuth, requireRoles("siswa"), async (req, res, next) => {
  try {
    const data = await saveStudentAnswer(req.body, req.profile.id);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/student/exam-sessions/:sessionId/submit",
  requireAuth,
  requireRoles("siswa"),
  async (req, res, next) => {
    try {
      const data = await submitStudentSession(req.params.sessionId, req.profile.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

app.post("/api/student/exam-sessions/submit", requireAuth, requireRoles("siswa"), async (req, res, next) => {
  try {
    const { session_id } = req.body || {};
    const data = await submitStudentSession(session_id, req.profile.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

let autoSubmitRunning = false;
async function runAutoSubmitSweep() {
  if (autoSubmitRunning) return;
  autoSubmitRunning = true;
  try {
    const { data: sessions, error } = await supabaseAdmin
      .from("exam_sessions")
      .select("id,student_id,schedule_id,status,submitted_at")
      .eq("status", "started")
      .is("submitted_at", null)
      .limit(300);
    if (error) throw error;

    const now = new Date();
    for (const session of sessions || []) {
      try {
        const schedule = await getSchedule(session.schedule_id);
        if (now > new Date(schedule.end_time)) {
          await submitStudentSession(session.id, session.student_id);
        }
      } catch (_err) {
        // skip one session if it fails
      }
    }
  } catch (_error) {
    // skip global sweep error
  } finally {
    autoSubmitRunning = false;
  }
}

app.get("/api/student/results", requireAuth, requireRoles("siswa"), async (req, res, next) => {
  try {
    const rows = await fromTable("exam_sessions", (q) =>
      q
        .select("id,exam_id,status,final_score,submitted_at,schedule_id")
        .eq("student_id", req.profile.id)
        .order("submitted_at", { ascending: false }),
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/student/results/:examId", requireAuth, requireRoles("siswa"), async (req, res, next) => {
  try {
    const rows = await fromTable("exam_sessions", (q) =>
      q
        .select("id,exam_id,status,final_score,submitted_at,schedule_id")
        .eq("student_id", req.profile.id)
        .eq("exam_id", req.params.examId)
        .order("submitted_at", { ascending: false }),
    );
    if (!rows.length) throw createError(404, "Hasil ujian tidak ditemukan.");
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/results", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    const rows = await getScopedResultRows(req, req.query || {});
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/results/export", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    const rows = await getScopedResultRows(req, req.query || {});
    if (!rows.length) {
      return res.status(404).json({ message: "Tidak ada data hasil untuk diexport." });
    }
    if (format === "pdf") {
      const doc = new PDFDocument({ size: "A4", margin: 32 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="hasil-ujian.pdf"');
      doc.pipe(res);
      doc.fontSize(16).text("Laporan Hasil Ujian", { underline: true });
      doc.moveDown();
      rows.forEach((r, idx) => {
        doc.fontSize(10).text(
          `${idx + 1}. exam=${r.exam_id} student=${r.student_id} score=${r.final_score} status=${r.status}`,
        );
      });
      doc.end();
      return;
    }

    const parser = new Parser({
      fields: ["id", "exam_id", "student_id", "status", "final_score", "submitted_at"],
    });
    const csv = parser.parse(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="hasil-ujian.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

app.get("/api/essay-answers", requireAuth, requireRoles("guru"), async (req, res, next) => {
  try {
    const role = getActorRole(req);
    let examsQuery = applySchoolScope(supabaseAdmin.from("exams").select("id,title,teacher_id"), req);
    if (role === "guru") {
      examsQuery = examsQuery.eq("teacher_id", req.profile.id);
    }
    const { data: exams, error: examsError } = await examsQuery;
    if (examsError) throw examsError;
    const examIds = (exams || []).map((exam) => exam.id);
    if (!examIds.length) return res.json([]);

    const { data: questions, error: questionError } = await supabaseAdmin
      .from("exam_questions")
      .select("id,exam_id,question_type")
      .in("exam_id", examIds)
      .eq("question_type", "essay");
    if (questionError) throw questionError;
    const essayQuestionIds = (questions || []).map((question) => question.id);
    if (!essayQuestionIds.length) return res.json([]);

    const [answersResult, studentsResult] = await Promise.all([
      supabaseAdmin
        .from("student_answers")
        .select("id,student_id,score,answer_text,session_id,graded_at,question_id")
        .in("question_id", essayQuestionIds),
      supabaseAdmin.from("students").select("id,full_name"),
    ]);
    if (answersResult.error) throw answersResult.error;
    if (studentsResult.error) throw studentsResult.error;

    const examMap = new Map((exams || []).map((exam) => [exam.id, exam]));
    const studentMap = new Map((studentsResult.data || []).map((student) => [student.id, student.full_name]));
    const questionToExamMap = new Map((questions || []).map((question) => [question.id, question.exam_id]));

    const sessionIds = [...new Set((answersResult.data || []).map((answer) => answer.session_id))];
    let sessions = [];
    if (sessionIds.length) {
      const { data, error } = await supabaseAdmin
        .from("exam_sessions")
        .select("id,exam_id")
        .in("id", sessionIds);
      if (error) throw error;
      sessions = data || [];
    }
    const sessionMap = new Map(sessions.map((session) => [session.id, session.exam_id]));

    res.json(
      (answersResult.data || []).map((answer) => {
        const examId = sessionMap.get(answer.session_id) || questionToExamMap.get(answer.question_id);
        const exam = examMap.get(examId);
        return {
          answer_id: answer.id,
          exam_id: examId,
          exam: exam?.title || "-",
          student: studentMap.get(answer.student_id) || answer.student_id,
          score: answer.score ?? 0,
          status: answer.graded_at ? "Sudah Ditinjau" : "Menunggu",
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/essay/grade", requireAuth, requireRoles("guru"), async (req, res, next) => {
  try {
    const { answer_id, score } = req.body || {};
    if (!answer_id) throw createError(400, "answer_id wajib diisi.");
    await ensureAnswerGradeAccess(req, answer_id);
    const { data, error } = await supabaseAdmin
      .from("student_answers")
      .update({
        score: toNumber(score, 0),
        graded_by: req.profile.id,
        graded_at: nowIso(),
      })
      .eq("id", answer_id)
      .select("*")
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", requireAuth, requireRoles("admin", "guru"), async (req, res, next) => {
  try {
    const role = getActorRole(req);
    const schoolId = req.profile.school_id;
    let school = null;
    if (role === "owner") {
      const { count, error } = await supabaseAdmin.from("schools").select("id", { count: "exact", head: true });
      if (error) throw error;
      return res.json({
        role,
        school: {
          name: "Global Owner",
          npsn: "-",
          status: "active",
        },
        security: {
          rls: true,
          rate_limit: true,
          api_key_masking: true,
        },
        counts: {
          schools: count || 0,
        },
      });
    }

    const { data, error } = await supabaseAdmin
      .from("schools")
      .select("id,name,npsn,status,address")
      .eq("id", schoolId)
      .maybeSingle();
    if (error) throw error;
    school = data;

    res.json({
      role,
      school: {
        name: school?.name || "-",
        npsn: school?.npsn || "-",
        status: school?.status || "-",
        address: school?.address || "-",
      },
      security: {
        rls: true,
        rate_limit: true,
        api_key_masking: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || "Terjadi kesalahan server.",
  });
});

const autoSubmitEnabled = String(process.env.AUTO_SUBMIT_ENABLED || "true").toLowerCase() !== "false";
const autoSubmitMs = Math.max(5000, Number(process.env.AUTO_SUBMIT_SWEEP_MS || 30000));
const isDirectRun = require.main === module;
if (isDirectRun) {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API server running on http://localhost:${port}`);
  });
}

if (isDirectRun && autoSubmitEnabled) {
  setInterval(() => {
    runAutoSubmitSweep();
  }, autoSubmitMs);
}

module.exports = app;
