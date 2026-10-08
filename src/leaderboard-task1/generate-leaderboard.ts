import type { Customer, CustomerField } from "./customer.js";
import type { LeaderboardRequest } from "./leaderboard-request.js";
import type { CustomerRepository } from "./repositories/customer-repository.js";
import type { ReportExporter } from "./exporters/report-exporter.js";

export interface LeaderboardReport {
  content: string;
  contentType: string;
  extension: string;
}

type Sort = LeaderboardRequest["sort"];

const COLUMNS: Record<CustomerField, { label: string; value: (customer: Customer) => string }> = {
  customer: { label: "Customer", value: (c) => c.displayName },
  spend: { label: "Spend", value: (c) => c.amountSpent },
  email: { label: "Email", value: (c) => c.email ?? "" },
  orders: { label: "Orders", value: (c) => c.numberOfOrders ?? "" },
};

function bySpend(a: Customer, b: Customer): number {
  return Number(a.amountSpent) - Number(b.amountSpent);
}

function byName(a: Customer, b: Customer): number {
  return a.displayName.localeCompare(b.displayName);
}

function displayOrder({ by, order }: Sort): (a: Customer, b: Customer) => number {
  const direction = order === "asc" ? 1 : -1;
  if (by === "spend") {
    return (a, b) => direction * bySpend(a, b) || byName(a, b);
  }
  return (a, b) => direction * byName(a, b) || bySpend(b, a);
}

export class GenerateLeaderboard {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly exporter: ReportExporter,
  ) { }

  async execute({ tags, limit, sort, fields }: LeaderboardRequest): Promise<LeaderboardReport> {
    const topSpenders = await this.customers.findTopSpenders({ tags, limit, fields });

    const columns = fields.map((field) => COLUMNS[field]);
    const rows = topSpenders
      .sort(displayOrder(sort))
      .map((customer) => columns.map((column) => column.value(customer)));

    return {
      content: this.exporter.export(columns.map((column) => column.label), rows),
      contentType: this.exporter.contentType,
      extension: this.exporter.extension,
    };
  }
}
