# RHEIR Shared Save Setup

This adds one shared proposal record for the hidden Lisa Alexander page without turning the site into a full app.

## What the page now expects

The proposal page calls:

- `GET /api/rheir/proposals/LisaAlexander`
- `POST /api/rheir/proposals/LisaAlexander`

The page sends the proposal password in the `X-RHEIR-Password` header.

## Smallest backend

Use the Cloudflare Worker in:

- [cloudflare/rheir-proposal-sync/src/index.js](/Users/kevinbarrett/Dev/SideHustle/itfactor-site/cloudflare/rheir-proposal-sync/src/index.js)

It stores:

- `rheir:proposal:LisaAlexander:current`
- `rheir:proposal:LisaAlexander:previous`

That gives one live shared copy and one rollback copy.

## Deployment steps

1. Create a Cloudflare KV namespace.
2. Replace the placeholder KV IDs in:
   - [cloudflare/rheir-proposal-sync/wrangler.toml](/Users/kevinbarrett/Dev/SideHustle/itfactor-site/cloudflare/rheir-proposal-sync/wrangler.toml)
3. Set the worker secret:
   - `wrangler secret put RHEIR_PROPOSAL_PASSWORD`
4. Use the same password value currently used by the hidden page:
   - `Alexander2026`
5. Add a route:
   - `itfactor.studio/api/rheir/proposals/*`
6. Deploy the worker:
   - `wrangler deploy`

## What the page saves

The shared payload includes:

- standard calculator field values
- advanced built-in line-item settings
- custom line items
- sidebar state
- updated time
- saved-by name

## Current page behavior

- `Save shared version` writes the shared proposal record
- `Load shared version` pulls the latest shared proposal record
- `Save local draft` still saves to the current browser only
- `Reset local draft` clears local browser state only

## Important limitation

This is still last-write-wins shared state.

It does **not** add:

- realtime collaboration
- multi-user conflict resolution
- user accounts
- revision history UI

That is intentional.
