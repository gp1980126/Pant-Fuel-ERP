# StationMitra — Antigravity + Firebase MCP

This repository is prepared for the official Firebase MCP server in Google Antigravity.

## Firebase TEST project
- Project ID: `pumppro-e47f2`

## MCP
Antigravity workspace MCP configuration:
`.agents/mcp_config.json`

Server:
`npx -y firebase-tools@latest mcp`

## Authorization
Run in the project terminal:
`firebase login --no-localhost`

Use the Google account that owns/administers the TEST Firebase project.

## Safety
- Do NOT migrate or modify SATAT production data during TEST work.
- Do NOT commit Firebase service-account private keys, passwords, OTPs, or other secrets.
- Multi-Pump design target: Owner -> multiple Pumps -> isolated tenant/pump data.
- Each pump must have a unique Pump ID and security boundary.

## First task after MCP connects
Inspect the existing Firebase project and current codebase. Do not deploy or alter production. Prepare a TEST-only Firebase Auth + Firestore architecture for multi-pump ownership and generate/validate Security Rules before any data migration.
