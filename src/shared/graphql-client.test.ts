import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "./errors.js";
import { GraphQLClient } from "./graphql-client.js";

const ENDPOINT = "https://store.myshopify.com/admin/api/2025-01/graphql.json";

function stubFetch(result: Response | Error) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

const client = new GraphQLClient({ endpoint: ENDPOINT, headers: { "X-Shopify-Access-Token": "token" } });

async function expectUpstreamError(promise: Promise<unknown>, cause: unknown) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code: "UPSTREAM_ERROR", status: 502, cause });
}

describe("GraphQLClient", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => { });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});

it("sends the query as a JSON POST and returns data", async () => {
  const fetchMock = stubFetch(jsonResponse({ data: { shop: { name: "x" } } }));

  const data = await client.request("query Q($id: ID!) { node(id: $id) { id } }", { id: "1" });

  expect(data).toEqual({ shop: { name: "x" } });
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe(ENDPOINT);
  expect(init?.method).toBe("POST");
  expect(init?.headers).toEqual({ "Content-Type": "application/json", "X-Shopify-Access-Token": "token" });
  expect(JSON.parse(init?.body as string)).toEqual({
    query: "query Q($id: ID!) { node(id: $id) { id } }",
    variables: { id: "1" },
  });
});

it("fails on non-2xx HTTP responses", async () => {
  stubFetch(new Response("Unauthorized", { status: 401 }));

  await expectUpstreamError(client.request("{ shop { name } }"), { status: 401, body: "Unauthorized" });
});

it("fails on GraphQL errors, even with partial data", async () => {
  const errors = [{ message: "Throttled", extensions: { code: "THROTTLED" } }];
  stubFetch(jsonResponse({ data: { shop: null }, errors }));

  await expectUpstreamError(client.request("{ shop { name } }"), errors);
});

it("fails on network errors", async () => {
  const networkError = new TypeError("fetch failed");
  stubFetch(networkError);

  await expectUpstreamError(client.request("{ shop { name } }"), networkError);
});
