import { describe, expect, it, vi } from "vitest";
import type { GraphQLClient } from "../../shared/graphql-client.js";
import { ShopifyFlagRepository } from "./shopify-flag-repository.js";

function setup(...responses: unknown[]) {
  const request = vi.fn();
  for (const response of responses) {
    request.mockResolvedValueOnce(response);
  }
  const repository = new ShopifyFlagRepository({ request } as unknown as GraphQLClient, "https://shop.myshopify.com");
  return { request, repository };
}

const NO_SERVICES = { shop: { fulfillmentServices: [] } };

describe("ShopifyFlagRepository", () => {
  it("reuses the fulfillment service with the same name and returns its service and location ids", async () => {
    const { request, repository } = setup({
      shop: {
        fulfillmentServices: [
          { id: "gid://shopify/FulfillmentService/A", serviceName: "Other", location: { id: "gid://shopify/Location/1" } },
          { id: "gid://shopify/FulfillmentService/B", serviceName: "Flag Service", location: { id: "gid://shopify/Location/2" } },
        ],
      },
    });

    await expect(repository.findOrCreateLocation("Flag Service")).resolves.toEqual({
      serviceId: "gid://shopify/FulfillmentService/B",
      locationId: "gid://shopify/Location/2",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("turns mutation userErrors into a 502 that keeps the errors as cause", async () => {
    const userErrors = [{ field: ["callbackUrl"], message: "Callback url can't be blank" }];
    const { repository } = setup(NO_SERVICES, {
      fulfillmentServiceCreate: { fulfillmentService: null, userErrors },
    });

    await expect(repository.findOrCreateLocation("Flag Service")).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
      status: 502,
      cause: userErrors,
    });
  });

  it("searches by SKU and only accepts an exact SKU match", async () => {
    const { request, repository } = setup({
      productVariants: {
        nodes: [
          { id: "gid://shopify/ProductVariant/1", sku: "TASK2-FLAG-OLD", inventoryItem: { id: "gid://shopify/InventoryItem/1" } },
          { id: "gid://shopify/ProductVariant/2", sku: "TASK2-FLAG", inventoryItem: { id: "gid://shopify/InventoryItem/2" } },
        ],
      },
    });

    const variant = await repository.findVariantBySku("TASK2-FLAG");

    expect(request.mock.calls[0]![1]).toEqual({ query: "sku:TASK2-FLAG" });
    expect(variant).toEqual({
      variantId: "gid://shopify/ProductVariant/2",
      inventoryItemId: "gid://shopify/InventoryItem/2",
    });
  });

  it("maps inventory levels and sums available into the total", async () => {
    const { repository } = setup({
      inventoryItem: {
        inventoryLevels: {
          nodes: [
            { location: { id: "gid://shopify/Location/1" }, quantities: [{ name: "available", quantity: -100100 }] },
            { location: { id: "gid://shopify/Location/2" }, quantities: [{ name: "available", quantity: 100000 }] },
          ],
        },
      },
    });

    await expect(repository.readFlagInventory("gid://shopify/InventoryItem/2")).resolves.toEqual({
      total: -100,
      levels: [
        { locationId: "gid://shopify/Location/1", available: -100100 },
        { locationId: "gid://shopify/Location/2", available: 100000 },
      ],
    });
  });

  it("filters orders by SKU and email and maps the order id", async () => {
    const { request, repository } = setup({
      orders: { nodes: [{ id: "gid://shopify/Order/1", name: "#1001", createdAt: "2026-02-02T00:00:00Z", email: "me@example.com" }] },
    });

    const orders = await repository.findOrders({ sku: "TASK2-FLAG", email: "me@example.com" });

    expect(request.mock.calls[0]![1]).toEqual({ query: 'sku:TASK2-FLAG AND email:"me@example.com"' });
    expect(orders[0]!.id).toBe("gid://shopify/Order/1");
  });

  it("deletes the fulfillment service by id", async () => {
    const { request, repository } = setup({ fulfillmentServiceDelete: { deletedId: "gid://shopify/FulfillmentService/B", userErrors: [] } });

    await repository.deleteService("gid://shopify/FulfillmentService/B", "gid://shopify/Location/1");

    expect(request.mock.calls[0]![1]).toEqual({
      id: "gid://shopify/FulfillmentService/B",
      destinationLocationId: "gid://shopify/Location/1",
    });
  });
});
