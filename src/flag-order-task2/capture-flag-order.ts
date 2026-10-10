import { AppError } from "../shared/errors.js";
import type { FlagOrderRequest, ShippingAddress } from "./flag-order-schema.js";
import type { FlagInventory, FlagOrder, FlagVariant } from "./flag-domain.js";
import type { FlagRepository } from "./ports/flag-repository.js";

export interface CapturedFlagOrder {
  order: { id: string; name: string; createdAt: string };
  checkoutUrl: string;
  sku: string;
  locationId: string;
  cleanedUp: boolean;
  cleanupError?: string;
}

const REFLOOD_INTERVAL_MS = 400;
const ORDER_POLL_INTERVAL_MS = 5000;

const SHIPPING_FIELDS: ReadonlyArray<[keyof ShippingAddress, string]> = [
  ["firstName", "first_name"],
  ["lastName", "last_name"],
  ["address1", "address1"],
  ["address2", "address2"],
  ["city", "city"],
  ["province", "province"],
  ["country", "country"],
  ["zip", "zip"],
];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function numericId(gid: string): string {
  return gid.slice(gid.lastIndexOf("/") + 1);
}

export function refloodDelta(total: number, margin: number): number {
  return margin - total;
}

export function pickNewOrder(orders: FlagOrder[], existingIds: Set<string>): FlagOrder | undefined {
  return orders.find((order) => !existingIds.has(order.id));
}

export function buildCheckoutUrl(storeUrl: string, variantNum: string, email: string, shippingAddress?: ShippingAddress): string {
  const parts = [`checkout[email]=${encodeURIComponent(email)}`];
  for (const [field, param] of SHIPPING_FIELDS) {
    const value = shippingAddress?.[field];
    if (value) {
      parts.push(`checkout[shipping_address][${param}]=${encodeURIComponent(value)}`);
    }
  }
  return `${storeUrl}/cart/${variantNum}:1?${parts.join("&")}`;
}

export class CaptureFlagOrder {
  private capturing = false;

  constructor(
    private readonly flags: FlagRepository,
    private readonly storeUrl: string,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) { }

  async execute(request: FlagOrderRequest): Promise<CapturedFlagOrder> {
    if (this.capturing) {
      throw new AppError("CAPTURE_IN_PROGRESS", "Another flag capture is already running", 409);
    }
    this.capturing = true;

    try {
      const { email, sku, serviceName, margin, holdSeconds, cleanup, shippingAddress } = request;

      const variant = await this.flags.findVariantBySku(sku);
      if (!variant) {
        throw new AppError("PRODUCT_NOT_FOUND", `No product variant with SKU ${sku}`, 404);
      }

      const { serviceId, locationId } = await this.flags.findOrCreateLocation(serviceName);
      const before = await this.flags.readFlagInventory(variant.inventoryItemId);
      const main = before.levels.find((level) => level.locationId !== locationId);
      const existingOrderIds = new Set((await this.flags.findOrders({ sku, email })).map((order) => order.id));

      const checkoutUrl = buildCheckoutUrl(this.storeUrl, numericId(variant.variantId), email, shippingAddress);
      console.log(`[flag-order] checkout ready, complete it in the browser: ${checkoutUrl}`);

      let order: FlagOrder | undefined;
      let cleanedUp = false;
      let cleanupError: string | undefined;
      try {
        order = await this.holdUntilOrder(variant, locationId, margin, holdSeconds, { sku, email }, existingOrderIds);
      } finally {
        if (cleanup) {
          try {
            await this.flags.deleteService(serviceId, main?.locationId);
            if (main) {
              await this.setAvailable(variant.inventoryItemId, main.locationId, main.available);
            }
            cleanedUp = true;
          } catch (error) {
            cleanupError = error instanceof Error ? error.message : String(error);
            console.error(`[flag-order] cleanup failed, left the service in place: ${cleanupError}`);
          }
        }
      }

      if (!order) {
        throw new AppError("ORDER_NOT_DETECTED", `No order appeared within ${holdSeconds}s; complete the checkout before the hold expires`, 409);
      }
      return { order: { id: order.id, name: order.name, createdAt: order.createdAt }, checkoutUrl, sku, locationId, cleanedUp, ...(cleanupError ? { cleanupError } : {}) };
    } finally {
      this.capturing = false;
    }
  }

  private async holdUntilOrder(
    variant: FlagVariant,
    locationId: string,
    margin: number,
    holdSeconds: number,
    criteria: { sku: string; email: string },
    existingOrderIds: Set<string>,
  ): Promise<FlagOrder | undefined> {
    const floor = Math.floor(margin / 2);
    const deadline = Date.now() + holdSeconds * 1000;
    let lastPoll = 0;

    while (Date.now() < deadline) {
      const inventory = await this.flags.readFlagInventory(variant.inventoryItemId);
      if (inventory.total < floor) {
        await this.topUp(variant.inventoryItemId, locationId, inventory, margin);
      }
      if (Date.now() - lastPoll >= ORDER_POLL_INTERVAL_MS) {
        lastPoll = Date.now();
        const found = pickNewOrder(await this.flags.findOrders(criteria), existingOrderIds);
        if (found) {
          return found;
        }
      }
      await this.wait(REFLOOD_INTERVAL_MS);
    }
    return undefined;
  }

  private async topUp(inventoryItemId: string, locationId: string, inventory: FlagInventory, margin: number): Promise<void> {
    const stock = { inventoryItemId, locationId };
    const delta = refloodDelta(inventory.total, margin);
    const ours = inventory.levels.find((level) => level.locationId === locationId);
    if (ours) {
      await this.flags.adjustAvailable(stock, delta);
    } else {
      await this.flags.activate(stock, delta);
    }
  }

  private async setAvailable(inventoryItemId: string, locationId: string, target: number): Promise<void> {
    const current = (await this.flags.readFlagInventory(inventoryItemId)).levels.find((level) => level.locationId === locationId)?.available ?? 0;
    const delta = target - current;
    if (delta !== 0) {
      await this.flags.adjustAvailable({ inventoryItemId, locationId }, delta);
    }
  }
}
