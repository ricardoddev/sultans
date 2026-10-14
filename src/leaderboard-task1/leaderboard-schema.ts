import { z } from "zod";
import { CUSTOMER_FIELDS } from "./customer-domain.js";

const tag = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[\p{L}\p{N} _:.\-]+$/u, "Tags may only contain letters, numbers, spaces and : _ . -");

export const leaderboardRequestSchema = z.strictObject({
  tags: z.array(tag).max(10).default(["task1", "level:3"]),
  limit: z.number().int().min(20).max(250).default(50),
  sort: z
    .strictObject({
      by: z.enum(["spend", "name"]).default("spend"),
      order: z.enum(["asc", "desc"]).optional(),
    })
    .transform(({ by, order }) => ({ by, order: order ?? (by === "name" ? "asc" : "desc") }))
    .prefault({}),
  fields: z
    .array(z.enum(CUSTOMER_FIELDS))
    .min(1)
    .max(CUSTOMER_FIELDS.length)
    .refine((fields) => new Set(fields).size === fields.length, "Fields must not repeat")
    .default(["customer", "spend"]),
});

export type LeaderboardRequest = z.infer<typeof leaderboardRequestSchema>;
