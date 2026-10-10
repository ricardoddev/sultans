import { describe, expect, it } from "vitest";
import { flagOrderSchema } from "./flag-order-request.js";

describe("flagOrderSchema", () => {
  it("turns an empty request into exactly Task 2", () => {
    expect(flagOrderSchema.parse({})).toEqual({
      email: "ricardodelgadofilhodev@gmail.com",
      sku: "TASK2-FLAG",
      serviceName: "Flag Order Task2 - Ricardoddev",
      margin: 3000,
      holdSeconds: 120,
      cleanup: true,
    });
  });

  it.each(["TASK2-FLAG'", "TASK2 FLAG", 'TASK2"FLAG'])("rejects SKU %j that could break out of the search query", (sku) => {
    expect(flagOrderSchema.safeParse({ sku }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(flagOrderSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(flagOrderSchema.safeParse({ unknown: 1 }).success).toBe(false);
  });
});
