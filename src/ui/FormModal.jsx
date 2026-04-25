export function FormModal({
  open,
  title,
  description,
  children,
  submitLabel = "Simpan",
  cancelLabel = "Batal",
  onSubmit,
  onClose,
  submitting = false,
  size = "md",
}) {
  if (!open) return null;

  const widthClass = size === "lg" ? "max-w-4xl" : size === "sm" ? "max-w-lg" : "max-w-2xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className={`w-full ${widthClass} rounded-2xl border border-slate-100 bg-white shadow-card`}>
        <div className="border-b border-slate-100 px-6 py-5">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Menyimpan..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
