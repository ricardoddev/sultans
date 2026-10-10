export interface ReportExporter {
  readonly contentType: string;
  readonly extension: string;
  export(header: string[], rows: string[][]): string;
}
