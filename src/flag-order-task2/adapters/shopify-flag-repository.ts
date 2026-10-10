import { AppError } from "../../shared/errors.js";
import type { GraphQLClient } from "../../shared/graphql-client.js";
import type { FlagInventory, FlagLocation, FlagOrder, FlagVariant, StockLocation } from "../flag-domain.js";
import type { FlagRepository } from "../ports/flag-repository.js";

interface UserError {
  field: string[] | null;
  message: string;
}

function assertNoUserErrors(mutation: string, payload: { userErrors: UserError[] }): void {
  if (payload.userErrors.length) {
    throw new AppError("UPSTREAM_ERROR", `Shopify rejected ${mutation}`, 502, { cause: payload.userErrors });
  }
}

const CALLBACK_PATH = "/fulfillment-service";

const FIND_VARIANT = `
  query FindVariantBySku($query: String!) {
    productVariants(first: 10, query: $query) {
      nodes { id sku inventoryItem { id } }
    }
  }
`;

const FIND_SERVICES = `
  query FindFulfillmentServices {
    shop { fulfillmentServices { id serviceName location { id } } }
  }
`;

const CREATE_SERVICE = `
  mutation CreateFulfillmentService($name: String!, $callbackUrl: URL!) {
    fulfillmentServiceCreate(name: $name, callbackUrl: $callbackUrl, inventoryManagement: false, trackingSupport: false) {
      fulfillmentService { id location { id } }
      userErrors { field message }
    }
  }
`;

const READ_INVENTORY = `
  query ReadFlagInventory($id: ID!) {
    inventoryItem(id: $id) {
      inventoryLevels(first: 20) {
        nodes {
          location { id }
          quantities(names: ["available"]) { name quantity }
        }
      }
    }
  }
`;

const ACTIVATE = `
  mutation ActivateInventory($inventoryItemId: ID!, $locationId: ID!, $available: Int!) {
    inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
      inventoryLevel { id }
      userErrors { field message }
    }
  }
`;

const ADJUST = `
  mutation AdjustAvailable($input: InventoryAdjustQuantitiesInput!) {
    inventoryAdjustQuantities(input: $input) {
      inventoryAdjustmentGroup { id }
      userErrors { field message }
    }
  }
`;

const FIND_ORDERS = `
  query FindOrders($query: String!) {
    orders(first: 10, sortKey: CREATED_AT, reverse: true, query: $query) {
      nodes { id name createdAt email }
    }
  }
`;

const DELETE_SERVICE = `
  mutation DeleteFulfillmentService($id: ID!, $destinationLocationId: ID) {
    fulfillmentServiceDelete(id: $id, destinationLocationId: $destinationLocationId, inventoryAction: TRANSFER) {
      deletedId
      userErrors { field message }
    }
  }
`;

export class ShopifyFlagRepository implements FlagRepository {
  constructor(
    private readonly client: GraphQLClient,
    private readonly storeUrl: string,
  ) { }

  async findVariantBySku(sku: string): Promise<FlagVariant | null> {
    const data = await this.client.request<{
      productVariants: { nodes: { id: string; sku: string | null; inventoryItem: { id: string } }[] };
    }>(FIND_VARIANT, { query: `sku:${sku}` });

    const variant = data.productVariants.nodes.find((node) => node.sku === sku);
    return variant ? { variantId: variant.id, inventoryItemId: variant.inventoryItem.id } : null;
  }

  async findOrCreateLocation(serviceName: string): Promise<FlagLocation> {
    const { shop } = await this.client.request<{
      shop: { fulfillmentServices: { id: string; serviceName: string; location: { id: string } | null }[] };
    }>(FIND_SERVICES);

    const existing = shop.fulfillmentServices.find((service) => service.serviceName === serviceName);
    if (existing?.location) {
      return { serviceId: existing.id, locationId: existing.location.id };
    }

    const { fulfillmentServiceCreate } = await this.client.request<{
      fulfillmentServiceCreate: {
        fulfillmentService: { id: string; location: { id: string } } | null;
        userErrors: UserError[];
      };
    }>(CREATE_SERVICE, {
      name: serviceName,
      callbackUrl: `${this.storeUrl}${CALLBACK_PATH}`,
    });

    assertNoUserErrors("fulfillmentServiceCreate", fulfillmentServiceCreate);
    const service = fulfillmentServiceCreate.fulfillmentService!;
    return { serviceId: service.id, locationId: service.location.id };
  }

  async readFlagInventory(inventoryItemId: string): Promise<FlagInventory> {
    const { inventoryItem } = await this.client.request<{
      inventoryItem: {
        inventoryLevels: { nodes: { location: { id: string }; quantities: { name: string; quantity: number }[] }[] };
      } | null;
    }>(READ_INVENTORY, { id: inventoryItemId });

    const levels = (inventoryItem?.inventoryLevels.nodes ?? []).map((node) => ({
      locationId: node.location.id,
      available: node.quantities.find((quantity) => quantity.name === "available")?.quantity ?? 0,
    }));
    const total = levels.reduce((sum, level) => sum + level.available, 0);
    return { total, levels };
  }

  async activate({ inventoryItemId, locationId }: StockLocation, available: number): Promise<void> {
    const { inventoryActivate } = await this.client.request<{
      inventoryActivate: { userErrors: UserError[] };
    }>(ACTIVATE, { inventoryItemId, locationId, available });

    assertNoUserErrors("inventoryActivate", inventoryActivate);
  }

  async adjustAvailable({ inventoryItemId, locationId }: StockLocation, delta: number): Promise<void> {
    const { inventoryAdjustQuantities } = await this.client.request<{
      inventoryAdjustQuantities: { userErrors: UserError[] };
    }>(ADJUST, {
      input: {
        name: "available",
        reason: "correction",
        changes: [{ delta, inventoryItemId, locationId }],
      },
    });

    assertNoUserErrors("inventoryAdjustQuantities", inventoryAdjustQuantities);
  }

  async findOrders({ sku, email }: { sku: string; email: string }): Promise<FlagOrder[]> {
    const { orders } = await this.client.request<{ orders: { nodes: FlagOrder[] } }>(FIND_ORDERS, {
      query: `sku:${sku} AND email:"${email}"`,
    });

    return orders.nodes;
  }

  async deleteService(serviceId: string, destinationLocationId?: string): Promise<void> {
    const { fulfillmentServiceDelete } = await this.client.request<{
      fulfillmentServiceDelete: { deletedId: string | null; userErrors: UserError[] };
    }>(DELETE_SERVICE, { id: serviceId, destinationLocationId: destinationLocationId ?? null });

    assertNoUserErrors("fulfillmentServiceDelete", fulfillmentServiceDelete);
  }
}
