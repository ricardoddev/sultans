# Sultans Test — Shopify Backend

A small TypeScript + Express API that solves the two tasks of the Sultans backend case study, talking to the Shopify **Admin GraphQL API** only (no REST).

- **Task 1 — Leaderboard:** generates a CSV with the top spenders of the store, filtered by customer tags (default: top 50 customers tagged `task1` **and** `level:3`).
- **Task 2 — Capture the Flag:** gets an order placed for the sold-out flag product (SKU `TASK2-FLAG`) and detects it, so the order confirmation email is sent.

Every route works with an **empty body**: the defaults reproduce the exact task. The body fields are optional and only change the behavior.

## Requirements

- Node.js **24+**
- A Shopify store domain and an Admin API access token

## Running the app

1. Install the dependencies:

   ```powershell
   npm install
   ```

2. Create the `.env` file from the example and fill it in:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Description |
   |---|---|---|
   | `SHOPIFY_STORE` | yes | Store domain, must end with `myshopify.com` (with or without `https://`) |
   | `SHOPIFY_ACCESS_TOKEN` | yes | Shopify Admin API access token |
   | `API_TOKEN` | yes | Bearer token that protects this API, at least 32 characters |
   | `SHOPIFY_API_VERSION` | no | Admin API version, format `YYYY-MM`. Default `2025-01` |
   | `PORT` | no | HTTP port. Default `3000` |

   The server does not start if any variable is missing or invalid. To generate an `API_TOKEN`:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Start the server:

   ```powershell
   npm run dev
   ```

   Or build and run the compiled version:

   ```powershell
   npm run build
   npm start
   ```

The server listens on `http://localhost:3000` (or the configured `PORT`).

### Other scripts

| Script | Description |
|---|---|
| `npm test` | Runs the unit tests (Vitest) |
| `npm run test-verbose` | Runs the unit tests with per-test output |
| `npm run typecheck` | Type-checks the project without emitting files |

## Authentication

Every request must send the `API_TOKEN` as a bearer token:

```
Authorization: Bearer <API_TOKEN>
```

Requests without a valid token get `401 UNAUTHORIZED`.

## Routes

### `POST /leaderboard`

Returns a CSV file download (`leaderboard-YYYY-MM-DD-HHmmss.csv`) with the top spenders among the customers that have **all** the given tags.

**Body** (all fields optional):

```json
{
  "tags": ["task1", "level:3"],
  "limit": 50,
  "sort": { "by": "spend", "order": "desc" },
  "fields": ["customer", "spend"]
}
```

| Field | Type | Rules | Default |
|---|---|---|---|
| `tags` | `string[]` | Up to 10 tags, combined with **AND**. Letters, numbers, spaces and `: _ . -` only. `[]` means no tag filter (whole store) | `["task1", "level:3"]` |
| `limit` | `integer` | Between 50 and 100 | `50` |
| `sort.by` | `"spend"` \| `"name"` | Display order of the rows | `"spend"` |
| `sort.order` | `"asc"` \| `"desc"` | Display direction | `"desc"` for `spend`, `"asc"` for `name` |
| `fields` | `string[]` | CSV columns, in the given order, no repeats. Options: `customer`, `spend`, `email`, `orders` | `["customer", "spend"]` |

The ranking is always by amount spent (highest first). `sort` only changes how the selected customers are displayed, not who gets in.

**Example response** (empty body):

```csv
Customer,Spend
Jane Doe,20000.0
John Smith,20000.0
...
```

### `POST /flag-order`

Makes the flag product purchasable, waits for an order to be placed through the store checkout, and returns that order.

The Admin token cannot create orders directly, so the order is placed in the browser:

1. Call the route. It stocks the flag in a dedicated fulfillment service location and keeps it in stock during the hold period.
2. The server prints a **checkout URL** in its console. Open it in the browser (enter the store password if asked) and complete the $0 checkout.
3. The route detects the new order, cleans up the store (removes the fulfillment service and restores the original stock) and responds.

The request stays open until the order is detected or `holdSeconds` runs out. Only one capture can run at a time.

**Body** (all fields optional):

```json
{
  "email": "you@example.com",
  "sku": "TASK2-FLAG",
  "serviceName": "Flag Order Task2 - Ricardoddev",
  "margin": 3000,
  "holdSeconds": 120,
  "cleanup": true,
  "billingAddress": {
    "firstName": "Jane",
    "lastName": "Doe",
    "address1": "123 Main St",
    "address2": "Apt 4",
    "city": "Toronto",
    "province": "ON",
    "country": "Canada",
    "zip": "M5V 2T6"
  }
}
```

| Field | Type | Rules | Default |
|---|---|---|---|
| `email` | `string` | Valid email. Prefilled in the checkout and used to detect the order | `ricardodelgadofilhodev@gmail.com` |
| `sku` | `string` | Letters, numbers and `_ . -` only | `TASK2-FLAG` |
| `serviceName` | `string` | Name of the fulfillment service used to stock the flag. Letters, numbers, spaces and `_ . -` only | `Flag Order Task2 - Ricardoddev` |
| `margin` | `integer` | 1 to 1,000,000. Stock level kept during the hold | `3000` |
| `holdSeconds` | `integer` | 5 to 600. Maximum time to wait for the order | `120` |
| `cleanup` | `boolean` | Remove the fulfillment service and restore the original stock at the end | `true` |
| `billingAddress` | `object` | Optional checkout prefill of the billing address (the flag does not require shipping, so the checkout has no shipping address). All subfields optional: `firstName`, `lastName`, `address1`, `address2`, `city`, `province`, `country`, `zip` | — |

**Example response:**

```json
{
  "order": {
    "id": "gid://shopify/Order/1234567890",
    "name": "#1234",
    "createdAt": "2026-10-10T12:00:00Z"
  },
  "checkoutUrl": "https://your-store.myshopify.com/cart/42795733614707:1?checkout[email]=you%40example.com",
  "sku": "TASK2-FLAG",
  "locationId": "gid://shopify/Location/1234567890",
  "cleanedUp": true
}
```

If the cleanup fails, the order is still returned, with `cleanedUp: false` and a `cleanupError` message.

## Errors

Errors are returned as JSON:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body does not match the rules above (unknown fields are also rejected) |
| 400 | `INVALID_JSON` | Body is not valid JSON |
| 401 | `UNAUTHORIZED` | Missing or invalid bearer token |
| 404 | `NOT_FOUND` | Unknown route |
| 404 | `PRODUCT_NOT_FOUND` | `/flag-order`: no variant with the given SKU |
| 409 | `CAPTURE_IN_PROGRESS` | `/flag-order`: another capture is already running |
| 409 | `ORDER_NOT_DETECTED` | `/flag-order`: no order was placed within `holdSeconds` |
| 500 | `INTERNAL_ERROR` | Unexpected error |
| 502 | `UPSTREAM_ERROR` | The Shopify API request failed or Shopify rejected a mutation |

## Project structure

The code follows a ports and adapters layout, with one folder per task:

```
src/
├── server.ts               # Entry point: loads env and starts the server
├── composition-root.ts     # Wires adapters, use cases and routers
├── app.ts                  # Express app: auth, JSON parsing, routes, error handling
├── leaderboard-task1/      # Task 1: router, schema, use case, ports and adapters (Shopify, CSV)
├── flag-order-task2/       # Task 2: router, schema, use case, ports and adapters (Shopify)
└── shared/                 # Env validation, bearer auth, errors, GraphQL client
```

### Task architecture

Both tasks follow the same flow: `router → schema → use case → port ← adapter`.

```
leaderboard-task1/
├── leaderboard-router.ts              # POST /leaderboard: parses the body and sends the CSV download
├── leaderboard-schema.ts              # Body rules and defaults (Zod)
├── generate-leaderboard.ts            # Use case: top spenders → display sort → columns → export
├── customer-domain.ts                 # Customer model and available fields
├── ports/
│   ├── customer-repository.ts         # Interface: find the top spenders
│   └── report-exporter.ts             # Interface: serialize the report
└── adapters/
    ├── shopify-customer-repository.ts # Shopify customer segment query
    └── csv-exporter.ts                # CSV file (UTF-8 with BOM)

flag-order-task2/
├── flag-order-router.ts               # POST /flag-order: parses the body and returns the order
├── flag-order-schema.ts               # Body rules and defaults (Zod)
├── capture-flag-order.ts              # Use case: stock the flag → wait for the order → clean up
├── flag-domain.ts                     # Variant, inventory, location and order models
├── ports/
│   └── flag-repository.ts             # Interface: product, inventory, location and order operations
└── adapters/
    └── shopify-flag-repository.ts     # Shopify queries and mutations
```
| Layer | Task 1 | Task 2 |
|---|---|---|
| Router | `leaderboard-router.ts`: parses the body, sends the CSV as a download | `flag-order-router.ts`: parses the body, returns the order as JSON |
| Schema | `leaderboard-schema.ts`: body rules and defaults | `flag-order-schema.ts`: body rules and defaults |
| Use case | `GenerateLeaderboard`: fetches the top spenders, applies the display sort, picks the columns and exports | `CaptureFlagOrder`: stocks the flag, keeps it in stock until the order shows up, then cleans up |
| Ports | `CustomerRepository`, `ReportExporter` | `FlagRepository` |
| Adapters | `ShopifyCustomerRepository` (customer segment query), `CsvExporter` (CSV file) | `ShopifyFlagRepository` (product, fulfillment service, inventory and order queries/mutations) |