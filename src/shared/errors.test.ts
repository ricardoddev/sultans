import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, errorHandler, notFoundHandler } from "./errors.js";

function fakeResponse() {
  const res = {
    headersSent: false,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

const fakeRequest = { method: "GET", path: "/missing" } as Request;

const next = vi.fn() as unknown as NextFunction;

function handle(error: unknown) {
  const res = fakeResponse();
  errorHandler(error, fakeRequest, res as unknown as Response, next);
  return res;
}

describe("notFoundHandler", () => {
  it("throws a 404 AppError that the error handler formats", () => {
    let thrown: unknown;
    try {
      notFoundHandler(fakeRequest, fakeResponse() as unknown as Response, next);
    } catch (error) {
      thrown = error;
    }

    const res = handle(thrown);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Route GET /missing not found" } });
  });
});

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps AppError to its status and code", () => {
    const res = handle(new AppError("CONFLICT", "Already exists", 409));

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: { code: "CONFLICT", message: "Already exists" } });
  });

  it("maps ZodError to 400 VALIDATION_ERROR", () => {
    const { error } = z.object({ limit: z.number() }).safeParse({ limit: "x" });

    const res = handle(error);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("maps a malformed JSON body to 400 INVALID_JSON", () => {
    const res = handle(Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed" }));

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON" } });
  });

  it("maps unknown errors to 500 without leaking the message", () => {
    vi.spyOn(console, "error").mockImplementation(() => { });

    const res = handle(new Error("secret internals"));

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  });
});
