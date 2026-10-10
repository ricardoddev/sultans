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
