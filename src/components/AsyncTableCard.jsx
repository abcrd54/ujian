import { DataTable } from "./DataTable";

export function AsyncTableCard({
  columns,
  dataState,
  renderCell,
  filterKey,
  filterOptions,
  rowActions,
  rowKey,
  emptyMessage,
}) {
  const { rows, loading, error } = dataState;

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-card">
        <div className="space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="h-10 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded bg-slate-100" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-100 bg-rose-50 p-6 shadow-card">
        <p className="text-sm text-rose-700">{error}</p>
      </section>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      renderCell={renderCell}
      filterKey={filterKey}
      filterOptions={filterOptions}
      rowActions={rowActions}
      rowKey={rowKey}
      emptyMessage={emptyMessage}
    />
  );
}
