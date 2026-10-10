import { describe, expect, it } from "vitest";
import type { Customer } from "./customer-domain.js";
import type { ReportExporter } from "./ports/report-exporter.js";
import { GenerateLeaderboard } from "./generate-leaderboard.js";
import { leaderboardRequestSchema } from "./leaderboard-schema.js";
import type { CustomerRepository, TopSpendersCriteria } from "./ports/customer-repository.js";

const CUSTOMERS: Customer[] = [
  { id: "1", displayName: "Carol", amountSpent: "9.0", email: "carol@example.com", numberOfOrders: "1" },
  { id: "2", displayName: "Bob", amountSpent: "10.0", email: null, numberOfOrders: "2" },
  { id: "3", displayName: "Alice", amountSpent: "10.0", email: "alice@example.com", numberOfOrders: "3" },
];

function setup() {
  const repository = {
    criteria: undefined as TopSpendersCriteria | undefined,
    async findTopSpenders(criteria: TopSpendersCriteria) {
      repository.criteria = criteria;
      return [...CUSTOMERS];
    },
  } satisfies CustomerRepository & { criteria?: TopSpendersCriteria };

  const exporter = {
    contentType: "text/fake",
    extension: "fake",
    header: [] as string[],
    rows: [] as string[][],
    export(header: string[], rows: string[][]) {
      exporter.header = header;
      exporter.rows = rows;
      return "content";
    },
  } satisfies ReportExporter & { header: string[]; rows: string[][] };

  return { repository, exporter, generateLeaderboard: new GenerateLeaderboard(repository, exporter) };
}

describe("GenerateLeaderboard", () => {
  it("ranks by spend (numerically) then by name, with Customer and Spend columns by default", async () => {
    const { exporter, generateLeaderboard } = setup();

    const report = await generateLeaderboard.execute(leaderboardRequestSchema.parse({}));

    expect(exporter.header).toEqual(["Customer", "Spend"]);
    expect(exporter.rows).toEqual([
      ["Alice", "10.0"],
      ["Bob", "10.0"],
      ["Carol", "9.0"],
    ]);
    expect(report).toEqual({ content: "content", contentType: "text/fake", extension: "fake" });
  });

  it("applies the requested display order and columns, and forwards the criteria to the repository", async () => {
    const { repository, exporter, generateLeaderboard } = setup();
    const request = leaderboardRequestSchema.parse({
      tags: ["vip"],
      limit: 60,
      sort: { by: "name", order: "asc" },
      fields: ["email", "customer"],
    });

    await generateLeaderboard.execute(request);

    expect(repository.criteria).toEqual({ tags: ["vip"], limit: 60, fields: ["email", "customer"] });
    expect(exporter.header).toEqual(["Email", "Customer"]);
    expect(exporter.rows).toEqual([
      ["alice@example.com", "Alice"],
      ["", "Bob"],
      ["carol@example.com", "Carol"],
    ]);
  });
});
