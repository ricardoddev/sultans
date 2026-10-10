import type { GraphQLClient } from "../../shared/graphql-client.js";
import type { Customer, CustomerField } from "../customer-domain.js";
import type { CustomerRepository, TopSpendersCriteria } from "../ports/customer-repository.js";

const BASE_SELECTION = "id displayName amountSpent { amount }";

const EXTRA_SELECTIONS: Partial<Record<CustomerField, string>> = {
  email: "defaultEmailAddress { emailAddress }",
  orders: "numberOfOrders",
};

interface TopSpendersResponse {
  customerSegmentMembers: {
    edges: {
      node: {
        id: string;
        displayName: string;
        amountSpent: { amount: string } | null;
        defaultEmailAddress?: { emailAddress: string | null } | null;
        numberOfOrders?: string;
      };
    }[];
  };
}

function buildQuery(fields: CustomerField[]): string {
  const extras = fields.flatMap((field) => EXTRA_SELECTIONS[field] ?? []);
  const selection = [BASE_SELECTION, ...extras].join(" ");

  return `
    query TopSpenders($query: String!, $first: Int!) {
      customerSegmentMembers(query: $query, first: $first, sortKey: "amount_spent", reverse: true) {
        edges { node { ${selection} } }
      }
    }
  `;
}

function toSegmentQuery(tags: string[]): string {
  return tags.map((tag) => `customer_tags CONTAINS '${tag}'`).join(" AND ");
}

export class ShopifyCustomerRepository implements CustomerRepository {
  constructor(private readonly client: GraphQLClient) { }

  async findTopSpenders({ tags, limit, fields }: TopSpendersCriteria): Promise<Customer[]> {
    const data = await this.client.request<TopSpendersResponse>(buildQuery(fields), {
      query: toSegmentQuery(tags),
      first: limit,
    });

    return data.customerSegmentMembers.edges.map(({ node }) => ({
      id: node.id,
      displayName: node.displayName,
      amountSpent: node.amountSpent?.amount ?? "",
      email: node.defaultEmailAddress?.emailAddress ?? null,
      numberOfOrders: node.numberOfOrders ?? null,
    }));
  }
}
