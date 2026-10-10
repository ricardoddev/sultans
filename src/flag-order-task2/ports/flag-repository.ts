import type { FlagInventory, FlagLocation, FlagOrder, FlagVariant, StockLocation } from "../flag-domain.js";

export interface FlagRepository {
  findVariantBySku(sku: string): Promise<FlagVariant | null>;
  findOrCreateLocation(serviceName: string): Promise<FlagLocation>;
  readFlagInventory(inventoryItemId: string): Promise<FlagInventory>;
  activate(stock: StockLocation, available: number): Promise<void>;
  adjustAvailable(stock: StockLocation, delta: number): Promise<void>;
  findOrders(criteria: { sku: string; email: string }): Promise<FlagOrder[]>;
  deleteService(serviceId: string, destinationLocationId?: string): Promise<void>;
}
