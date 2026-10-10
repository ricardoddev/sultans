export const CUSTOMER_FIELDS = ["customer", "spend", "email", "orders"] as const;

export type CustomerField = (typeof CUSTOMER_FIELDS)[number];

export interface Customer {
  id: string;
  displayName: string;
  amountSpent: string;
  email?: string | null;
  numberOfOrders?: string | null;
}
