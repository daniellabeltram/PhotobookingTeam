// CSV writer (docs/api.md export): UTF-8 BOM, CRLF, every field quoted, formula-injection guard.
const FORMULA_START = /^[=+\-@\t\r]/;

/** Cells that a spreadsheet could read as a formula get a leading apostrophe. */
export function guardCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}
export function quoteCell(value: string): string {
  return `"${guardCell(value).replace(/"/g, '""')}"`;
}
export function toCsv(rows: string[][]): string {
  return "﻿" + rows.map((r) => r.map(quoteCell).join(",")).join("\r\n") + "\r\n";
}
