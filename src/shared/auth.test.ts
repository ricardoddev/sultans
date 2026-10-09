import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { bearerAuth } from "./auth.js";

const TOKEN = "a".repeat(32);

function authenticate(authorization?: string) {
  const req = { get: () => authorization } as unknown as Request;
  const next = vi.fn() as unknown as NextFunction;
  bearerAuth(TOKEN)(req, {} as Response, next);
  return next;
}

describe("bearerAuth", () => {
  it("lets the request through when the bearer token matches", () => {
    expect(authenticate(`Bearer ${TOKEN}`)).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing header", undefined],
    ["wrong token", `Bearer ${"b".repeat(32)}`],
    ["token without the Bearer scheme", TOKEN],
  ])("rejects with 401 on %s", (_case, authorization) => {
    expect(() => authenticate(authorization)).toThrow(
      expect.objectContaining({ status: 401, code: "UNAUTHORIZED" }),
    );
  });
});
