import express, { type Express } from "express";
import { errorHandler, notFoundHandler } from "./shared/errors.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
