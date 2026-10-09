import type { Express } from "express";
import { createApp } from "./app.js";
import { CsvExporter } from "./leaderboard-task1/exporters/csv-exporter.js";
import { GenerateLeaderboard } from "./leaderboard-task1/generate-leaderboard.js";
import { createLeaderboardRouter } from "./leaderboard-task1/leaderboard-router.js";
import { ShopifyCustomerRepository } from "./leaderboard-task1/repositories/shopify-customer-repository.js";
import type { Env } from "./shared/env.js";
import { GraphQLClient } from "./shared/graphql-client.js";

export function compose(env: Env): Express {
  const adminClient = new GraphQLClient({
    endpoint: `${env.SHOPIFY_STORE}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
    headers: { "X-Shopify-Access-Token": env.SHOPIFY_ACCESS_TOKEN },
  });

  const reportExporter = new CsvExporter()

  const customerRepository = new ShopifyCustomerRepository(adminClient);
  const generateLeaderboard = new GenerateLeaderboard(customerRepository, reportExporter);

  return createApp([createLeaderboardRouter(generateLeaderboard)]);
}
