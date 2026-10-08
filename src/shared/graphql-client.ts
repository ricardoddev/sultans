import { AppError } from "./errors.js";

export interface GraphQLClientConfig {
  endpoint: string;
  headers: Record<string, string>;
  timeoutMs?: number;
}

interface GraphQLResponse<TData> {
  data: TData;
  errors?: unknown[];
}

function upstreamError(cause: unknown): AppError {
  return new AppError("UPSTREAM_ERROR", "Shopify API request failed", 502, { cause });
}

export class GraphQLClient {
  constructor(private readonly config: GraphQLClientConfig) { }

  async request<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    let response: Response;
    try {
      response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
      });
    } catch (error) {
      throw upstreamError(error);
    }

    if (!response.ok) {
      throw upstreamError({ status: response.status, body: await response.text() });
    }

    const payload = (await response.json()) as GraphQLResponse<TData>;
    if (payload.errors?.length) {
      throw upstreamError(payload.errors);
    }

    return payload.data;
  }
}
