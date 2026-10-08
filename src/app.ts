import express, { type Express, type Router } from "express";
import { errorHandler, notFoundHandler } from "./shared/errors.js";

export function createApp(routers: Router[]): Express {
  const app = express();
  app.use(express.json());
  for (const router of routers) {
    app.use(router);
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
