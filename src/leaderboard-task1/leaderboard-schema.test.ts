import { describe, expect, it } from "vitest";
import { leaderboardRequestSchema } from "./leaderboard-schema.js";

describe("leaderboardRequestSchema", () => {
  it("turns an empty body into exactly Task 1", () => {
    expect(leaderboardRequestSchema.parse({})).toEqual({
      tags: ["task1", "level:3"],
      limit: 50,
      sort: { by: "spend", order: "desc" },
      fields: ["customer", "spend"],
    });
  });

  it.each([
    [{ by: "name" }, { by: "name", order: "asc" }],
    [{ by: "spend" }, { by: "spend", order: "desc" }],
    [{ by: "name", order: "desc" }, { by: "name", order: "desc" }],
  ])("defaults sort order by field %j", (sort, expected) => {
    expect(leaderboardRequestSchema.parse({ sort }).sort).toEqual(expected);
  });

  it("rejects tags that could break out of the segment query", () => {
    expect(leaderboardRequestSchema.safeParse({ tags: ["task1'"] }).success).toBe(false);
  });

  it.each([{ limt: 100 }, { sort: { ordr: "asc" } }])("rejects unknown keys %j", (body) => {
    expect(leaderboardRequestSchema.safeParse(body).success).toBe(false);
  });

  it.each([19, 251])("rejects limit %i (allowed: 20 to 250)", (limit) => {
    expect(leaderboardRequestSchema.safeParse({ limit }).success).toBe(false);
  });
});
