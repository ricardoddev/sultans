import { describe, expect, it } from "vitest";
import { leaderboardRequestSchema } from "./leaderboard-request.js";

describe("leaderboardRequestSchema", () => {
  it("turns an empty body into exactly Task 1", () => {
    expect(leaderboardRequestSchema.parse({})).toEqual({
      tags: ["task1", "level:3"],
      limit: 50,
      sort: { by: "spend", order: "desc" },
      fields: ["customer", "spend"],
    });
  });

  it("rejects tags that could break out of the segment query", () => {
    expect(leaderboardRequestSchema.safeParse({ tags: ["task1'"] }).success).toBe(false);
  });

  it.each([{ limt: 100 }, { sort: { ordr: "asc" } }])("rejects unknown keys %j", (body) => {
    expect(leaderboardRequestSchema.safeParse(body).success).toBe(false);
  });

  it.each([49, 101])("rejects limit %i (allowed: 50 to 100)", (limit) => {
    expect(leaderboardRequestSchema.safeParse({ limit }).success).toBe(false);
  });
});
