import type { Customer, CustomerField } from "../customer-domain.js";

export interface TopSpendersCriteria {
  tags: string[];
  limit: number;
  fields: CustomerField[];
}

export interface CustomerRepository {
  findTopSpenders(criteria: TopSpendersCriteria): Promise<Customer[]>;
}
