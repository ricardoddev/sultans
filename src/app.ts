import express, { type Express, type RequestHandler, type Router } from "express";
import { errorHandler, notFoundHandler } from "./shared/errors.js";

export function createApp(auth: RequestHandler, routers: Router[]): Express {
  const app = express();

  app.use(auth);
  app.use(express.json());

  for (const router of routers) {
    app.use(router);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
