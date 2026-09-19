# StationMitra Firebase MCP setup

This project can use the official Firebase MCP server from a compatible MCP client.

## Cursor

The repository includes `.cursor/mcp.json` with the official Firebase MCP configuration.

1. Open this repository in Cursor.
2. Sign in to Firebase/Google when the Firebase MCP asks for authentication.
3. Select the Firebase project `pumppro-e47f2`.
4. Keep the existing Supabase production project untouched.
5. For Multi-Pump work, use a separate Firebase TEST environment first.

The MCP server runs:

`npx -y firebase-tools@latest mcp`

Do not put Firebase service-account private keys, passwords, or OTPs in this repository.

## Scope

The intended Firebase test architecture is:
Owner -> multiple Pumps -> isolated tenant/pump data.

Each pump must have its own pump ID and security boundary. SATAT production data must not be migrated or modified as part of the initial test.
