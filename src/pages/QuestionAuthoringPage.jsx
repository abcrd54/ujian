import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  downloadExamQuestionTemplate,
  getExamQuestions,
  getExams,
  importExamQuestions,
  submitExamQuestions,
  syncExamQuestions,
  uploadExamImage,
} from "../services/dashboardService";
import { useToast } from "../ui/ToastContext";

const statusClass = {
  Terjadwal: "bg-blue-50 text-blue-700",
  Menunggu: "bg-amber-50 text-amber-700",
  Draf: "bg-slate-100 text-slate-700",
  Disetujui: "bg-emerald-50 text-emerald-700",
};

const initialQuestionForm = {
  question_type: "pg",
  question_text: "",
  image_url: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  option_e: "",
  correct_answer: "",
  rubric_answer: "",
  score_weight: 1,
  explanation: "",
  order_number: 1,
};

function normalizeAnswer(value) {
  return String(value || "").trim().toUpperCase();
}

function createLocalQuestion(orderNumber = 1) {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...initialQuestionForm,
    order_number: orderNumber,
  };
}

function hydrateQuestionForm(question) {
  if (!question) return initialQuestionForm;
  return {
    question_type: question.question_type || "pg",
    question_text: question.question_text || "",
    image_url: question.image_url || "",
    option_a: question.option_a || "",
    option_b: question.option_b || "",
    option_c: question.option_c || "",
    option_d: question.option_d || "",
    option_e: question.option_e || "",
    correct_answer: question.correct_answer || "",
    rubric_answer: question.rubric_answer || "",
    score_weight: Number(question.score_weight) || 1,
    explanation: question.explanation || "",
    order_number: Number(question.order_number) || 1,
  };
}

function isQuestionComplete(question) {
  if (!String(question?.question_text || "").trim()) return false;
  if (String(question?.question_type || "pg") === "essay") {
    return Boolean(String(question?.rubric_answer || "").trim());
  }
  const requiredOptions = [question?.option_a, question?.option_b, question?.option_c, question?.option_d];
  const hasOptions = requiredOptions.every((item) => String(item || "").trim());
  return hasOptions && ["A", "B", "C", "D", "E"].includes(normalizeAnswer(question?.correct_answer));
}

function getNextOrderNumber(questions) {
  return (
    (questions || []).reduce((max, item) => Math.max(max, Number(item.order_number) || 0), 0) + 1
  );
}

function sanitizeQuestions(questions) {
  return (questions || []).map((question, index) => ({
    ...question,
    order_number: Number(question.order_number) || index + 1,
    score_weight: Number(question.score_weight) || 1,
    correct_answer: normalizeAnswer(question.correct_answer),
  }));
}

export function QuestionAuthoringPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const imageRef = useRef(null);
  const importRef = useRef(null);
  const hydratedExamRef = useRef("");
  const [draftQuestions, setDraftQuestions] = useState([]);
  const [activeQuestionId, setActiveQuestionId] = useState("");
  const [questionForm, setQuestionForm] = useState(initialQuestionForm);
  const [finalizing, setFinalizing] = useState(false);
  const examsState = useAsyncData(getExams);
  const activeExamId = searchParams.get("examId") || "";
  const activeExam = examsState.rows.find((item) => item.id === activeExamId) || null;

  const fetchQuestions = useCallback(() => {
    if (!activeExamId) return Promise.resolve([]);
    return getExamQuestions(activeExamId);
  }, [activeExamId]);
  const questionsState = useAsyncData(fetchQuestions, [activeExamId]);

  const workspaceQuestions = useMemo(
    () =>
      sanitizeQuestions(draftQuestions).sort(
        (left, right) => (Number(left.order_number) || 0) - (Number(right.order_number) || 0),
      ),
    [draftQuestions],
  );

  const activeQuestionIndex = useMemo(
    () => workspaceQuestions.findIndex((item) => item.id === activeQuestionId),
    [activeQuestionId, workspaceQuestions],
  );

  const activeQuestion = activeQuestionIndex >= 0 ? workspaceQuestions[activeQuestionIndex] : null;
  const previousQuestion = activeQuestionIndex > 0 ? workspaceQuestions[activeQuestionIndex - 1] : null;
  const nextQuestion =
    activeQuestionIndex >= 0 && activeQuestionIndex < workspaceQuestions.length - 1
      ? workspaceQuestions[activeQuestionIndex + 1]
      : null;

  const completionStats = useMemo(() => {
    const total = workspaceQuestions.length;
    const complete = workspaceQuestions.filter(isQuestionComplete).length;
    return {
      total,
      complete,
      incomplete: Math.max(total - complete, 0),
    };
  }, [workspaceQuestions]);

  const validationItems = useMemo(() => {
    const hasQuestions = workspaceQuestions.length > 0;
    const pgIncomplete = workspaceQuestions.some(
      (item) => item.question_type === "pg" && !isQuestionComplete(item),
    );
    const essayIncomplete = workspaceQuestions.some(
      (item) => item.question_type === "essay" && !isQuestionComplete(item),
    );
    return [
      { label: "Minimal ada satu soal", done: hasQuestions },
      { label: "Semua soal pilihan ganda punya opsi dan jawaban benar", done: !pgIncomplete },
      { label: "Semua soal esai punya rubrik penilaian", done: !essayIncomplete },
    ];
  }, [workspaceQuestions]);

  useEffect(() => {
    if (!activeExamId) {
      hydratedExamRef.current = "";
      setDraftQuestions([]);
      setActiveQuestionId("");
      setQuestionForm(initialQuestionForm);
      return;
    }
    if (hydratedExamRef.current === activeExamId) {
      return;
    }
    const serverQuestions = sanitizeQuestions(questionsState.rows || []);
    if (questionsState.loading && !serverQuestions.length && !questionsState.error) {
      return;
    }
    hydratedExamRef.current = activeExamId;
    if (!serverQuestions.length) {
      const firstDraft = createLocalQuestion(1);
      setDraftQuestions([firstDraft]);
      setActiveQuestionId(firstDraft.id);
      setQuestionForm(hydrateQuestionForm(firstDraft));
      return;
    }
    setDraftQuestions(serverQuestions);
    setActiveQuestionId(serverQuestions[0].id);
    setQuestionForm(hydrateQuestionForm(serverQuestions[0]));
  }, [activeExamId, questionsState.error, questionsState.loading, questionsState.rows]);

  useEffect(() => {
    if (!activeQuestionId) return;
    setDraftQuestions((previous) =>
      previous.map((item) =>
        item.id === activeQuestionId
          ? {
              ...item,
              ...questionForm,
              correct_answer: normalizeAnswer(questionForm.correct_answer),
            }
          : item,
      ),
    );
  }, [activeQuestionId, questionForm]);

  function openExamWorkspace(examId) {
    setSearchParams({ examId });
  }

  function closeExamWorkspace() {
    setSearchParams({});
    setDraftQuestions([]);
    setActiveQuestionId("");
    setQuestionForm(initialQuestionForm);
  }

  function selectQuestion(question) {
    setActiveQuestionId(question.id);
    setQuestionForm(hydrateQuestionForm(question));
  }

  function startNewQuestion() {
    const newQuestion = createLocalQuestion(getNextOrderNumber(workspaceQuestions));
    setDraftQuestions((previous) => [...previous, newQuestion]);
    setActiveQuestionId(newQuestion.id);
    setQuestionForm(hydrateQuestionForm(newQuestion));
  }

  function removeActiveQuestion() {
    if (!activeQuestionId) return;
    const remainingQuestions = workspaceQuestions.filter((item) => item.id !== activeQuestionId);
    if (!remainingQuestions.length) {
      const firstDraft = createLocalQuestion(1);
      setDraftQuestions([firstDraft]);
      setActiveQuestionId(firstDraft.id);
      setQuestionForm(hydrateQuestionForm(firstDraft));
      showToast("Soal dihapus. Sistem menyiapkan satu formulir kosong agar pengisian dapat dilanjutkan.");
      return;
    }
    const fallbackQuestion = previousQuestion || nextQuestion || remainingQuestions[0];
    setDraftQuestions(remainingQuestions);
    setActiveQuestionId(fallbackQuestion.id);
    setQuestionForm(hydrateQuestionForm(fallbackQuestion));
    showToast("Soal dihapus dari susunan soal.");
  }

  function moveToPreviousQuestion() {
    if (!previousQuestion) return;
    selectQuestion(previousQuestion);
  }

  function moveToNextQuestion() {
    if (!nextQuestion) return;
    selectQuestion(nextQuestion);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file || !activeExamId) return;
    try {
      const result = await importExamQuestions(activeExamId, file);
      const importedRows = sanitizeQuestions(result.rows || []);
      if (importedRows.length) {
        setDraftQuestions((previous) => {
          const nextOrderStart = getNextOrderNumber(previous);
          return [
            ...previous,
            ...importedRows.map((row, index) => ({
              ...row,
              order_number: nextOrderStart + index,
            })),
          ];
        });
      }
      showToast(`${result.inserted || 0} soal berhasil diimpor.`);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      event.target.value = "";
    }
  }

  async function handleUploadImage(event) {
    const file = event.target.files?.[0];
    if (!file || !activeExamId || !activeExam?.school_id) return;
    try {
      const result = await uploadExamImage(activeExamId, file, activeExam.school_id);
      setQuestionForm((previous) => ({ ...previous, image_url: result.image_url }));
      showToast("Gambar soal berhasil diunggah.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      event.target.value = "";
    }
  }

  async function handleFinalizeAndSubmit() {
    if (!activeExamId) return;
    if (!validationItems.every((item) => item.done)) {
      showToast("Masih ada soal yang belum lengkap. Selesaikan dulu sebelum dikirim.", "error");
      return;
    }
    setFinalizing(true);
    try {
      const payload = workspaceQuestions.map((question, index) => ({
        ...question,
        order_number: index + 1,
      }));
      const syncResult = await syncExamQuestions(activeExamId, payload);
      setDraftQuestions(syncResult.rows || []);
      if ((syncResult.rows || [])[0]) {
        setActiveQuestionId(syncResult.rows[0].id);
        setQuestionForm(hydrateQuestionForm(syncResult.rows[0]));
      }
      await submitExamQuestions(activeExamId);
      await examsState.reload();
      await questionsState.reload();
      showToast("Seluruh soal berhasil disimpan dan dikirim kepada admin.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setFinalizing(false);
    }
  }

  if (!activeExamId) {
    return (
      <>
      <PageHeader
        title="Pembuatan Soal"
        description="Guru memilih item ujian yang ditugaskan admin, lalu masuk ke ruang kerja penyusunan soal."
        hideAction
      />

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <p className="text-sm text-slate-500">Langkah 1</p>
            <h2 className="mt-1 text-lg font-semibold">Pilih Ujian</h2>
            <p className="mt-2 text-sm text-slate-600">Pilih satu ujian agar proses penyusunan berjalan lebih terfokus.</p>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <p className="text-sm text-slate-500">Langkah 2</p>
            <h2 className="mt-1 text-lg font-semibold">Susun Satu Kesatuan Soal</h2>
            <p className="mt-2 text-sm text-slate-600">Seluruh soal disusun dalam satu ruang kerja agar prosesnya lebih tertata.</p>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <p className="text-sm text-slate-500">Langkah 3</p>
            <h2 className="mt-1 text-lg font-semibold">Finalisasi dan Kirim</h2>
            <p className="mt-2 text-sm text-slate-600">Setelah seluruh isi lengkap, simpan seluruh soal lalu kirim kepada admin.</p>
          </article>
        </section>

        <section className="mb-6 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Mulai dari template yang benar</h2>
              <p className="mt-1 text-sm text-slate-600">
                Untuk pengerjaan 20-40 soal, unduh template Excel agar input massal lebih cepat dan rapi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadExamQuestionTemplate()}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              Unduh Templat Excel
            </button>
          </div>
        </section>

        {examsState.loading ? (
          <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-card">
            <div className="space-y-3">
              <div className="h-5 w-1/4 animate-pulse rounded bg-slate-200" />
              <div className="h-24 animate-pulse rounded bg-slate-100" />
              <div className="h-24 animate-pulse rounded bg-slate-100" />
            </div>
          </section>
        ) : examsState.error ? (
          <section className="rounded-xl border border-rose-100 bg-rose-50 p-6 shadow-card">
            <p className="text-sm text-rose-700">{examsState.error}</p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {examsState.rows.map((exam) => (
              <article key={exam.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{exam.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{exam.subject} / {exam.class_name}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[exam.status] || "bg-slate-100 text-slate-700"}`}>
                    {exam.status}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-slate-500">Guru</p>
                    <p className="mt-1 font-semibold text-slate-900">{exam.teacher}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-slate-500">Durasi</p>
                    <p className="mt-1 font-semibold text-slate-900">{exam.duration_minutes || 0} menit</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">Masuk ke ruang kerja untuk menyusun seluruh soal ujian.</p>
                  <button
                    type="button"
                    onClick={() => openExamWorkspace(exam.id)}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Masuk ke Ruang Kerja
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Ruang Kerja Soal"
        description="Seluruh perubahan disusun terlebih dahulu di ruang kerja ini, kemudian disimpan dan dikirim kepada admin secara bersamaan."
        hideAction
      />

      <div className="mb-6">
        <button
          type="button"
          onClick={closeExamWorkspace}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Kembali ke daftar ujian
        </button>
      </div>

      <input ref={importRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
      <input ref={imageRef} type="file" accept="image/*" hidden onChange={handleUploadImage} />

      <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ujian Aktif</p>
            <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-slate-950">{activeExam?.title || "-"}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {activeExam?.subject || "-"} / {activeExam?.class_name || "-"} / Guru: {activeExam?.teacher || "-"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadExamQuestionTemplate()}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              Unduh Templat
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              Impor Data Excel
            </button>
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              Unggah Gambar Soal
            </button>
            {role === "guru" ? (
              <button
                type="button"
                onClick={handleFinalizeAndSubmit}
                disabled={finalizing}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {finalizing ? "Menyimpan dan Mengirim..." : "Finalisasi dan Kirim kepada Admin"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total Soal</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{completionStats.total}</p>
        </article>
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Sudah Lengkap</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-700">{completionStats.complete}</p>
        </article>
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Perlu Dilengkapi</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-700">{completionStats.incomplete}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950">Navigasi Soal</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Seluruh soal untuk ujian ini dikelola melalui bagian ini.</p>
            </div>
            <button
              type="button"
              onClick={startNewQuestion}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
            >
              Tambah Soal
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {workspaceQuestions.map((question) => {
              const active = question.id === activeQuestionId;
              const complete = isQuestionComplete(question);
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => selectQuestion(question)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : complete
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Soal {question.order_number}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        complete
                          ? "bg-white/80 text-emerald-700"
                          : "bg-white/80 text-amber-700"
                      }`}
                    >
                      {complete ? "Lengkap" : "Belum Lengkap"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Panduan Singkat</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
              Lengkapi seluruh soal pada ruang kerja ini, periksa status setiap nomor, lalu lakukan finalisasi pada tahap akhir.
            </p>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Editor Aktif</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Soal {activeQuestionIndex >= 0 ? activeQuestionIndex + 1 : 1} dari {workspaceQuestions.length || 1}
                </h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isQuestionComplete(activeQuestion || questionForm)
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {isQuestionComplete(activeQuestion || questionForm) ? "Sudah lengkap" : "Belum lengkap"}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">
                Soal {activeQuestionIndex >= 0 ? activeQuestionIndex + 1 : 1} dari {workspaceQuestions.length || 1}
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Semua perubahan pada halaman ini disimpan sebagai rancangan sementara sampai dilakukan finalisasi.
              </p>
            </div>
            <button
              type="button"
              onClick={removeActiveQuestion}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600"
            >
              Hapus dari Susunan
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Tipe soal</span>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={questionForm.question_type}
                onChange={(e) => setQuestionForm((previous) => ({ ...previous, question_type: e.target.value }))}
              >
                <option value="pg">Pilihan Ganda</option>
                <option value="essay">Esai</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Nomor urut</span>
              <input
                type="number"
                min="1"
                readOnly
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={questionForm.order_number}
              />
              <span className="mt-1.5 block text-xs text-slate-500">Nomor urut diatur otomatis oleh sistem.</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Bobot nilai</span>
              <input
                type="number"
                min="1"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={questionForm.score_weight}
                onChange={(e) =>
                  setQuestionForm((previous) => ({ ...previous, score_weight: Number(e.target.value) || 1 }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">URL gambar</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Masukkan URL gambar"
                value={questionForm.image_url}
                onChange={(e) => setQuestionForm((previous) => ({ ...previous, image_url: e.target.value }))}
              />
            </label>

            <label className="block md:col-span-2 xl:col-span-4">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Pertanyaan</span>
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                rows={4}
                placeholder="Tulis pertanyaan dengan jelas"
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm((previous) => ({ ...previous, question_text: e.target.value }))}
              />
            </label>

            {questionForm.question_type === "pg" ? (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Opsi A</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={questionForm.option_a} onChange={(e) => setQuestionForm((previous) => ({ ...previous, option_a: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Opsi B</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={questionForm.option_b} onChange={(e) => setQuestionForm((previous) => ({ ...previous, option_b: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Opsi C</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={questionForm.option_c} onChange={(e) => setQuestionForm((previous) => ({ ...previous, option_c: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Opsi D</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={questionForm.option_d} onChange={(e) => setQuestionForm((previous) => ({ ...previous, option_d: e.target.value }))} />
                </label>
                <label className="block md:col-span-2 xl:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Opsi E</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={questionForm.option_e} onChange={(e) => setQuestionForm((previous) => ({ ...previous, option_e: e.target.value }))} />
                </label>
                <label className="block md:col-span-2 xl:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Jawaban benar</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={questionForm.correct_answer}
                    onChange={(e) =>
                      setQuestionForm((previous) => ({ ...previous, correct_answer: normalizeAnswer(e.target.value) }))
                    }
                  >
                    <option value="">Pilih jawaban benar</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                  </select>
                </label>
              </>
            ) : (
              <label className="block md:col-span-2 xl:col-span-4">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Pedoman Penilaian Esai</span>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  rows={4}
                  placeholder="Tuliskan poin penilaian atau acuan jawaban ideal untuk esai"
                  value={questionForm.rubric_answer}
                  onChange={(e) => setQuestionForm((previous) => ({ ...previous, rubric_answer: e.target.value }))}
                />
              </label>
            )}

            <label className="block md:col-span-2 xl:col-span-4">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Penjelasan tambahan</span>
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                rows={3}
                placeholder="Opsional, isi bila perlu penjelasan untuk reviewer"
                value={questionForm.explanation}
                onChange={(e) => setQuestionForm((previous) => ({ ...previous, explanation: e.target.value }))}
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={moveToPreviousQuestion}
              disabled={!previousQuestion}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Soal Sebelumnya
            </button>
            <button
              type="button"
              onClick={moveToNextQuestion}
              disabled={!nextQuestion}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Soal Berikutnya
            </button>
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">Ringkasan Kerja</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">Pantau perkembangan penyusunan soal sebelum disimpan dan dikirim kepada admin.</p>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Progress kelengkapan</span>
              <span>{completionStats.complete}/{completionStats.total || 0}</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${completionStats.total ? (completionStats.complete / completionStats.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {validationItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3">
                <span className={`material-symbols-outlined text-[20px] ${item.done ? "text-emerald-600" : "text-amber-600"}`}>
                  {item.done ? "check_circle" : "error"}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.done ? "Sudah aman." : "Masih perlu diperiksa."}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <p className="text-sm font-semibold text-slate-950">Kapan soal dikirim kepada admin?</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Kirim kepada admin setelah seluruh nomor berstatus lengkap dan isi soal telah final. Tombol di atas akan menyimpan seluruh soal sekaligus sebelum mengirimkannya.
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}

