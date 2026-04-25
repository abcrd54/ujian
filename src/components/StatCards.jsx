export function StatCards({ items }) {
  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <article key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-card">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <span className="material-symbols-outlined">{item.icon}</span>
          </div>
          <p className="text-xs uppercase tracking-wide text-text-muted">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold">{item.value}</p>
        </article>
      ))}
    </section>
  );
}
