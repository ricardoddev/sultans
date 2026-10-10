export interface FlagVariant {
  variantId: string;
  inventoryItemId: string;
}

export interface StockLocation {
  inventoryItemId: string;
  locationId: string;
}

export interface FlagLocation {
  serviceId: string;
  locationId: string;
}

export interface InventoryLevel {
  locationId: string;
  available: number;
}

export interface FlagInventory {
  total: number;
  levels: InventoryLevel[];
}

export interface FlagOrder {
  id: string;
  name: string;
  createdAt: string;
  email: string | null;
}

export interface FlagRepository {
  findVariantBySku(sku: string): Promise<FlagVariant | null>;
  findOrCreateLocation(serviceName: string): Promise<FlagLocation>;
  readFlagInventory(inventoryItemId: string): Promise<FlagInventory>;
  activate(stock: StockLocation, available: number): Promise<void>;
  adjustAvailable(stock: StockLocation, delta: number): Promise<void>;
  findOrders(criteria: { sku: string; email: string }): Promise<FlagOrder[]>;
  deleteService(serviceId: string, destinationLocationId?: string): Promise<void>;
}
