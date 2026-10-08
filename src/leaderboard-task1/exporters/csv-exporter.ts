import type { ReportExporter } from "./report-exporter.js";

const BOM = "﻿";
const NEEDS_QUOTES = /[",\r\n]/;

function escapeCell(value: string): string {
  return NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export class CsvExporter implements ReportExporter {
  readonly contentType = "text/csv; charset=utf-8";
  readonly extension = "csv";

  export(header: string[], rows: string[][]): string {
    const lines = [header, ...rows].map((cells) => cells.map(escapeCell).join(","));
    return BOM + lines.join("\r\n");
  }
}
