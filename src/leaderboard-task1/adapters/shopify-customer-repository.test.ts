import { describe, expect, it, vi } from "vitest";
import type { GraphQLClient } from "../../shared/graphql-client.js";
import { ShopifyCustomerRepository } from "./shopify-customer-repository.js";

function setup(nodes: unknown[] = []) {
  const request = vi.fn().mockResolvedValue({ customerSegmentMembers: { edges: nodes.map((node) => ({ node })) } });
  const repository = new ShopifyCustomerRepository({ request } as unknown as GraphQLClient);
  return { request, repository };
}

describe("ShopifyCustomerRepository", () => {
  it("translates tags into an AND segment filter and the limit into `first`", async () => {
    const { request, repository } = setup();

    await repository.findTopSpenders({ tags: ["task1", "level:3"], limit: 50, fields: ["customer", "spend"] });
    await repository.findTopSpenders({ tags: [], limit: 50, fields: ["customer", "spend"] });

    expect(request.mock.calls[0]![1]).toEqual({
      query: "customer_tags CONTAINS 'task1' AND customer_tags CONTAINS 'level:3'",
      first: 50,
    });
    expect(request.mock.calls[1]![1]).toEqual({ query: "", first: 50 });
  });

  it("selects optional fields only when requested and maps the response", async () => {
    const { request, repository } = setup([
      {
        id: "gid://shopify/CustomerSegmentMember/1",
        displayName: "Alice",
        amountSpent: { amount: "20000.0" },
        defaultEmailAddress: null,
        numberOfOrders: "1",
      },
    ]);

    await repository.findTopSpenders({ tags: [], limit: 50, fields: ["customer", "spend"] });
    const customers = await repository.findTopSpenders({ tags: [], limit: 50, fields: ["email", "orders"] });

    const [defaultQuery] = request.mock.calls[0]!;
    const [extendedQuery] = request.mock.calls[1]!;
    expect(defaultQuery).not.toContain("defaultEmailAddress");
    expect(defaultQuery).not.toContain("numberOfOrders");
    expect(extendedQuery).toContain("defaultEmailAddress { emailAddress }");
    expect(extendedQuery).toContain("numberOfOrders");
    expect(customers).toEqual([
      {
        id: "gid://shopify/CustomerSegmentMember/1",
        displayName: "Alice",
        amountSpent: "20000.0",
        email: null,
        numberOfOrders: "1",
      },
    ]);
  });
});
