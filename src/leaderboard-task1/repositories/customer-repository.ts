import type { Customer, CustomerField } from "../customer.js";

export interface TopSpendersCriteria {
  tags: string[];
  limit: number;
  fields: CustomerField[];
}

export interface CustomerRepository {
  findTopSpenders(criteria: TopSpendersCriteria): Promise<Customer[]>;
}
