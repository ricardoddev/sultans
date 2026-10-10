import { Router } from "express";
import type { CaptureFlagOrder } from "./capture-flag-order.js";
import { flagOrderSchema } from "./flag-order-schema.js";

export function createFlagOrderRouter(captureFlagOrder: CaptureFlagOrder): Router {
  const router = Router();

  router.post("/flag-order", async (req, res) => {
    const request = flagOrderSchema.parse(req.body ?? {});
    res.json(await captureFlagOrder.execute(request));
  });

  return router;
}
