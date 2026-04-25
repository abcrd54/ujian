export function PageHeader({
  title,
  description,
  actionLabel = "Tambah Data",
  actionIcon = "add",
  onAction,
  hideAction = false,
}) {
  return (
    <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold lg:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      {!hideAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <span className="material-symbols-outlined text-[20px]">{actionIcon}</span>
          {actionLabel}
        </button>
      )}
    </section>
  );
}
