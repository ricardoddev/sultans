import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError } from "./errors.js";

export function bearerAuth(token: string): RequestHandler {
  const expected = Buffer.from(`Bearer ${token}`);

  return (req, _res, next) => {
    const received = Buffer.from(req.get("authorization") ?? "");

    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new AppError("UNAUTHORIZED", "Missing or invalid bearer token", 401);
    }

    next();
  };
}
