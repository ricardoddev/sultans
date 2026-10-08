import { Router } from "express";
import type { GenerateLeaderboard } from "./generate-leaderboard.js";
import { leaderboardRequestSchema } from "./leaderboard-request.js";

function timestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${day}-${time}`;
}

export function createLeaderboardRouter(generateLeaderboard: GenerateLeaderboard): Router {
  const router = Router();

  router.post("/leaderboard", async (req, res) => {
    const request = leaderboardRequestSchema.parse(req.body ?? {});
    const report = await generateLeaderboard.execute(request);

    res.attachment(`leaderboard-${timestamp(new Date())}.${report.extension}`);
    res.type(report.contentType);
    res.send(report.content);
  });

  return router;
}
