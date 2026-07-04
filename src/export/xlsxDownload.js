import * as XLSX from "xlsx";

/**
 * @param {string[]} headers
 * @param {Record<string, string | number | null | undefined>[]} rows
 * @param {string} filename
 */
export function downloadXlsx(headers, rows, filename) {
  const sheetRows = rows.map(row =>
    headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined || v === "") return "";
      if (typeof v === "number" && Number.isFinite(v)) return v;
      return v;
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetRows]);

  for (let r = 1; r <= sheetRows.length; r += 1) {
    for (let c = 0; c < headers.length; c += 1) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      if (!cell) continue;
      if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
        cell.t = "n";
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

export function exportFilename(prefix, { all, month }) {
  return all ? `${prefix}-all.xlsx` : `${prefix}-${month || "all"}.xlsx`;
}
