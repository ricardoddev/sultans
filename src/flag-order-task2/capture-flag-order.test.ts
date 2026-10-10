import { describe, expect, it } from "vitest";
import { buildCheckoutUrl, CaptureFlagOrder, pickNewOrder, refloodDelta } from "./capture-flag-order.js";
import type { FlagOrderRequest } from "./flag-order-request.js";
import type { FlagInventory, FlagOrder, FlagRepository } from "./repositories/flag-repository.js";

const VARIANT = { variantId: "gid://shopify/ProductVariant/42", inventoryItemId: "gid://shopify/InventoryItem/7" };
const MAIN = "gid://shopify/Location/1";
const OURS = "gid://shopify/Location/99";
const SERVICE_ID = "gid://shopify/FulfillmentService/9";

const OLD_ORDER: FlagOrder = { id: "gid://shopify/Order/OLD", name: "#1001", createdAt: "2026-01-01T00:00:00Z", email: "me@example.com" };
const NEW_ORDER: FlagOrder = { id: "gid://shopify/Order/NEW", name: "#1002", createdAt: "2026-02-02T00:00:00Z", email: "me@example.com" };

function makeRequest(overrides: Partial<FlagOrderRequest> = {}): FlagOrderRequest {
  return { email: "me@example.com", sku: "TASK2-FLAG", serviceName: "Flag Service", margin: 3000, holdSeconds: 60, cleanup: true, ...overrides };
}

function setup({ inventories, orders, deleteError }: { inventories: FlagInventory[]; orders: FlagOrder[][]; deleteError?: string }) {
  const calls = {
    activated: [] as number[],
    adjusted: [] as { locationId: string; delta: number }[],
    deleted: [] as { id: string; destinationLocationId?: string }[],
  };
  let invIndex = 0;
  let orderIndex = 0;
  const repository: FlagRepository = {
    async findVariantBySku() {
      return VARIANT;
    },
    async findOrCreateLocation() {
      return { serviceId: SERVICE_ID, locationId: OURS };
    },
    async readFlagInventory() {
      return inventories[Math.min(invIndex++, inventories.length - 1)]!;
    },
    async activate(_stock, available) {
      calls.activated.push(available);
    },
    async adjustAvailable(stock, delta) {
      calls.adjusted.push({ locationId: stock.locationId, delta });
    },
    async findOrders() {
      return orders[Math.min(orderIndex++, orders.length - 1)]!;
    },
    async deleteService(id, destinationLocationId) {
      calls.deleted.push({ id, destinationLocationId });
      if (deleteError) {
        throw new Error(deleteError);
      }
    },
  };
  const useCase = new CaptureFlagOrder(repository, "https://shop.myshopify.com", async () => { });
  return { calls, useCase };
}

const CAPTURING_INVENTORIES: FlagInventory[] = [
  { total: -100, levels: [{ locationId: MAIN, available: -100 }] },
  { total: 3000, levels: [{ locationId: MAIN, available: -3100 }, { locationId: OURS, available: 6100 }] },
  { total: -100, levels: [{ locationId: MAIN, available: -5000 }, { locationId: OURS, available: 4900 }] },
];

describe("CaptureFlagOrder", () => {
  it("returns the newly created order and cleans up the store by default", async () => {
    const { calls, useCase } = setup({ inventories: CAPTURING_INVENTORIES, orders: [[OLD_ORDER], [OLD_ORDER, NEW_ORDER]] });

    const result = await useCase.execute(makeRequest());

    expect(result.order).toEqual({ id: NEW_ORDER.id, name: NEW_ORDER.name, createdAt: NEW_ORDER.createdAt });
    expect(result).toMatchObject({
      sku: "TASK2-FLAG",
      locationId: OURS,
      checkoutUrl: "https://shop.myshopify.com/cart/42:1?checkout[email]=me%40example.com",
    });
    expect(result.cleanedUp).toBe(true);
    expect(calls.deleted).toEqual([{ id: SERVICE_ID, destinationLocationId: MAIN }]);
    expect(calls.adjusted).toEqual([{ locationId: MAIN, delta: 4900 }]);
  });

  it("leaves the service and main location untouched when cleanup is false", async () => {
    const { calls, useCase } = setup({ inventories: CAPTURING_INVENTORIES, orders: [[OLD_ORDER], [OLD_ORDER, NEW_ORDER]] });

    const result = await useCase.execute(makeRequest({ cleanup: false }));

    expect(result.cleanedUp).toBe(false);
    expect(calls.deleted).toEqual([]);
    expect(calls.adjusted).toEqual([]);
  });

  it("still returns the captured order when cleanup fails, flagging it", async () => {
    const { calls, useCase } = setup({
      inventories: CAPTURING_INVENTORIES,
      orders: [[OLD_ORDER], [OLD_ORDER, NEW_ORDER]],
      deleteError: "location_id has_fulfillment_orders_error",
    });

    const result = await useCase.execute(makeRequest());

    expect(result.order.id).toBe(NEW_ORDER.id);
    expect(result.cleanedUp).toBe(false);
    expect(result.cleanupError).toContain("has_fulfillment_orders_error");
    expect(calls.deleted).toEqual([{ id: SERVICE_ID, destinationLocationId: MAIN }]);
  });

  it("fails with 409 when no order appears before the hold expires", async () => {
    const { useCase } = setup({
      inventories: [{ total: -100, levels: [{ locationId: MAIN, available: -100 }] }],
      orders: [[OLD_ORDER]],
    });

    await expect(useCase.execute(makeRequest({ cleanup: false, holdSeconds: 0 }))).rejects.toMatchObject({
      code: "ORDER_NOT_DETECTED",
      status: 409,
    });
  });
});

describe("refloodDelta", () => {
  it("returns the amount needed to raise the total to the margin", () => {
    expect(refloodDelta(-110, 3000)).toBe(3110);
    expect(refloodDelta(20, 3000)).toBe(2980);
  });
});

describe("pickNewOrder", () => {
  it("returns the first order whose id was not present before the capture", () => {
    expect(pickNewOrder([OLD_ORDER, NEW_ORDER], new Set([OLD_ORDER.id]))).toEqual(NEW_ORDER);
  });

  it("returns undefined when every order already existed", () => {
    expect(pickNewOrder([OLD_ORDER], new Set([OLD_ORDER.id]))).toBeUndefined();
  });
});

describe("buildCheckoutUrl", () => {
  it("builds a permalink with the url-encoded email and literal bracket keys", () => {
    expect(buildCheckoutUrl("https://shop.myshopify.com", "42", "me@example.com")).toBe(
      "https://shop.myshopify.com/cart/42:1?checkout[email]=me%40example.com",
    );
  });

  it("appends only the shipping fields that are present", () => {
    const url = buildCheckoutUrl("https://shop.myshopify.com", "42", "me@example.com", { firstName: "Jo Jo", zip: "A1A 1A1" });

    expect(url).toContain("checkout[shipping_address][first_name]=Jo%20Jo");
    expect(url).toContain("checkout[shipping_address][zip]=A1A%201A1");
    expect(url).not.toContain("last_name");
  });
});
