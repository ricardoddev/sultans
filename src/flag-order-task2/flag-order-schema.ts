import { z } from "zod";

export const DEFAULT_EMAIL = "ricardodelgadofilhodev@gmail.com";
export const DEFAULT_SKU = "TASK2-FLAG";
export const DEFAULT_SERVICE_NAME = "Flag Order Task2 - Ricardoddev";

const email = z.email().default(DEFAULT_EMAIL);

const sku = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9_.\-]+$/, "SKU may only contain letters, numbers and _ . -")
  .default(DEFAULT_SKU);

const serviceName = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[\p{L}\p{N} _.\-]+$/u, "Service name may only contain letters, numbers, spaces and _ . -")
  .default(DEFAULT_SERVICE_NAME);

const addressField = z.string().trim().min(1).max(255).optional();

const billingAddressSchema = z.strictObject({
  firstName: addressField,
  lastName: addressField,
  address1: addressField,
  address2: addressField,
  city: addressField,
  province: addressField,
  country: addressField,
  zip: addressField,
});

export const flagOrderSchema = z.strictObject({
  email,
  sku,
  serviceName,
  margin: z.number().int().min(1).max(1_000_000).default(3000),
  holdSeconds: z.number().int().min(5).max(600).default(120),
  cleanup: z.boolean().default(true),
  billingAddress: billingAddressSchema.optional(),
});

export type FlagOrderRequest = z.infer<typeof flagOrderSchema>;
export type BillingAddress = z.infer<typeof billingAddressSchema>;
