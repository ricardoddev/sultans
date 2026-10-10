import type { Express } from "express";
import { createApp } from "./app.js";
import { CaptureFlagOrder } from "./flag-order-task2/capture-flag-order.js";
import { createFlagOrderRouter } from "./flag-order-task2/flag-order-router.js";
import { ShopifyFlagRepository } from "./flag-order-task2/adapters/shopify-flag-repository.js";
import { CsvExporter } from "./leaderboard-task1/adapters/csv-exporter.js";
import { GenerateLeaderboard } from "./leaderboard-task1/generate-leaderboard.js";
import { createLeaderboardRouter } from "./leaderboard-task1/leaderboard-router.js";
import { ShopifyCustomerRepository } from "./leaderboard-task1/adapters/shopify-customer-repository.js";
import { bearerAuth } from "./shared/auth.js";
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

  const flagRepository = new ShopifyFlagRepository(adminClient, env.SHOPIFY_STORE);
  const captureFlagOrder = new CaptureFlagOrder(flagRepository, env.SHOPIFY_STORE);

  const appBearerToken = env.API_TOKEN

  return createApp(bearerAuth(appBearerToken), [
    createLeaderboardRouter(generateLeaderboard),
    createFlagOrderRouter(captureFlagOrder),
  ]);
}
