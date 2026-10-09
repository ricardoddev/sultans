import { z } from "zod";

function toHttpsUrl(store: string): string {
  const host = store.replace("https://", "").replace("http://", "");
  return `https://${host}`;
}

const envSchema = z.object({
  SHOPIFY_STORE: z
    .string()
    .endsWith("myshopify.com", "SHOPIFY_STORE must end with myshopify.com")
    .transform(toHttpsUrl),
  SHOPIFY_ACCESS_TOKEN: z.string().min(1),
  API_TOKEN: z.string().min(32, "API_TOKEN must have at least 32 characters"),
  SHOPIFY_API_VERSION: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "SHOPIFY_API_VERSION must have the format YYYY-MM")
    .default("2025-01"),
  PORT: z.coerce.number().int().default(3000),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
