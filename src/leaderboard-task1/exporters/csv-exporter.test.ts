import { describe, expect, it } from "vitest";
import { CsvExporter } from "./csv-exporter.js";

const exporter = new CsvExporter();

describe("CsvExporter", () => {
  it("writes a UTF-8 BOM, the header first and CRLF line endings", () => {
    const csv = exporter.export(["Customer", "Spend"], [["Alice", "20000.0"]]);

    expect(csv).toBe("﻿Customer,Spend\r\nAlice,20000.0");
  });

  it("quotes cells per RFC 4180 only when needed", () => {
    const csv = exporter.export(["Customer"], [["Smith, John"], ['Say "hi"'], ["Plain"]]);

    expect(csv).toBe('﻿Customer\r\n"Smith, John"\r\n"Say ""hi"""\r\nPlain');
  });
});
