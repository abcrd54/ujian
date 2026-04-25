import { useMemo, useState } from "react";

export function DataTable({
  columns,
  rows,
  renderCell,
  searchable = true,
  filterKey,
  filterOptions = [],
  rowActions,
  rowKey = "id",
  emptyMessage = "Data belum tersedia.",
}) {
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return (rows || []).filter((row) => {
      const hitKeyword =
        !kw ||
        columns.some((col) =>
          String(row[col.key] ?? "")
            .toLowerCase()
            .includes(kw),
        );
      const hitFilter =
        !filterKey || filter === "all" || String(row[filterKey] || "").toLowerCase() === filter;
      return hitKeyword && hitFilter;
    });
  }, [rows, columns, keyword, filter, filterKey]);

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-card">
      {(searchable || filterOptions.length > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {searchable && (
            <input
              className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
              placeholder="Cari data..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          )}
          {filterOptions.length > 0 && (
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">Semua</option>
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-3">
                  {column.label}
                </th>
              ))}
              {rowActions ? <th className="px-3 py-3 text-right">Aksi</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, index) => (
              <tr key={row[rowKey] || index} className="border-b border-slate-50">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 text-slate-700">
                    {renderCell ? renderCell(row, column.key) : row[column.key]}
                  </td>
                ))}
                {rowActions ? <td className="px-3 py-3 text-right">{rowActions(row)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}
