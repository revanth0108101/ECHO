# ECHO — The Internet’s Memory

ECHO is a private, account-scoped place to save notes, links, clippings, and images, then reconnect them through search, collections, saved relationships, and archive-grounded recall. It addresses the “saved somewhere, lost later” problem by keeping an item’s context and sources close to the idea.

## Features

- Capture, edit, inspect, and delete notes, text clippings, links, images, and screenshots.
- Browse and filter a personal memory archive with keyword search, dates, topics, and tags.
- Organize saved records into collections and maintain explicit graph links.
- Explore a graph, timeline, archive coverage view, and persisted assistant conversations.
- Ask recall questions against retrieved, account-owned memories. When a server-side AI service is unavailable, the deterministic fallback is labelled as demo intelligence; semantic search is not enabled without a verified embeddings provider.
- Open a read-only demo archive only when explicitly selected. Demo examples use synthetic IDs, are not written to the database, and are not mixed into personal search, graph, collections, or recall.
- Review legacy sample records created by earlier versions in Settings. They remain preserved separately until the owner explicitly moves an individual record into the personal archive.

## Technology and architecture

- **Client:** React, TypeScript, Vite, Tailwind CSS, TanStack Query, Wouter, and React Flow.
- **API:** Express and tRPC with Zod input schemas and authenticated procedures.
- **Persistence:** Drizzle ORM and MySQL; the existing schema and checked-in migrations are under `drizzle/`.
- **Identity:** Manus OAuth and signed server-side sessions. The authenticated user ID is the owner key for personal records.
- **AI:** Optional server-side Manus chat-completions integration. API credentials must remain server-side; only explicitly allowlisted public configuration is projected to the browser.

The client calls typed tRPC procedures. Protected procedures derive ownership from the verified session rather than accepting an owner ID from a browser request. `server/echo-db.ts` owns account-scoped persistence; `server/routers.ts` validates inputs and coordinates API behavior. Image list responses include metadata but not attachment bytes; the selected image is fetched through an authenticated owner-checked procedure. Memory rows and their relationship/membership writes use a database transaction.

## Requirements

Use Node.js 20.19+ or 22.12+ and pnpm 10.18 (the repository’s package-manager version). You also need a MySQL database for local persistence and a configured Manus OAuth application for sign-in. The hosted Webdev environment supplies its managed database and OAuth values.

## Installation and local development

```bash
pnpm install --frozen-lockfile
cp .env.example .env
# Fill local values in .env; never commit .env or paste secrets into source files.
pnpm dev
```

The development server listens on `PORT` (default `3000`). In a local environment, set `DATABASE_URL` to a database reserved for development. Do not run destructive checks or apply schema changes against a shared or production database.

## Environment variables

| Variable | Required | Purpose / handling |
| --- | --- | --- |
| `DATABASE_URL` | Yes for persistence and Drizzle commands | MySQL connection string. Server-side only. |
| `MANUS_PROJECT_ID` | For Manus OAuth | Project identifier used by the server and public platform bootstrap. |
| `MANUS_JWT_SECRET` | For signed sessions | Private session signing secret; server-side only. |
| `MANUS_OAUTH_API_URL` | For Manus OAuth | OAuth/session service endpoint. |
| `MANUS_OAUTH_PORTAL_URL` | Optional platform bootstrap | Browser-facing OAuth portal URL; public configuration only. |
| `MANUS_API_URL` | Optional | Manus service endpoint used by server-side AI and other platform helpers. The public bootstrap exposes only the endpoint URL, not its credential. |
| `MANUS_API_KEY` | Optional for live AI | Private server-side API credential. When the AI service is unavailable, ECHO uses its labelled deterministic fallback. |
| `MANUS_API_BROWSER_KEY` | Optional platform bootstrap | Public/browser-scoped platform key. Do not use a private service key here. |
| `OWNER_OPEN_ID` | Optional legacy role hint | Existing platform compatibility setting; not required for normal account-scoped access. |
| `PORT` | Optional | HTTP listener port; defaults to `3000`. |
| `NODE_ENV` | Optional | Set to `development` for Vite middleware or `production` for static serving. |

`.env.example` contains names and blank placeholders only. For hosted Webdev, configure values through the project’s protected settings rather than adding them to client code or the repository.

## Database setup and migrations

Drizzle schema is defined in `drizzle/schema.ts`; checked-in SQL migrations are in `drizzle/`. For an isolated local MySQL database:

```bash
pnpm db:migrate
```

`pnpm db:push` generates and applies schema changes and should be used only when intentionally changing a disposable/development database. Review generated migrations before applying them. Webdev’s development and published application share the managed database, so schema/data operations there affect persistent user data; do not use them as test fixtures. Tests in this repository use synthetic records and mocked persistence and do not connect to the managed database.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the Express/Vite development server. |
| `pnpm check` | Run the TypeScript compiler without emitting files. |
| `pnpm test` | Run the Vitest suite. |
| `pnpm build` | Build the client and bundle the production server. |
| `pnpm start` | Start the built production server. |
| `pnpm build:static` | Build only the static client. |
| `pnpm db:migrate` | Apply checked-in Drizzle migrations to the configured MySQL database. |
| `pnpm db:push` | Generate and apply schema changes; use only with a deliberately selected development database. |

## Screenshots

The repository includes these interface captures from the project’s earlier QA walkthrough:

- [Memory library](deliverables/qa-frames/library.png)
- [Knowledge graph](deliverables/qa-frames/graph.png)
- [AI recall](deliverables/qa-frames/recall.png)
- [Settings](deliverables/qa-frames/settings.png)

## Future improvements

- Add semantic retrieval only after confirming a documented embedding provider and a compatible, account-scoped vector storage/query path.
- Add paginated archive APIs and larger-archive graph optimizations when measured usage warrants them.
- Expand automated repository-mocked tests to cover database-level cross-owner isolation, collection membership, graph-link transactions, and image handling in the running application.
- Continue accessibility review for keyboard focus management, modal focus trapping, responsive layouts, and contrast.

## Licensing

No `LICENSE` or `COPYING` file is currently present, and no license is asserted in `package.json`. No licensing terms or copyright ownership are stated here. Contact the project owner before reusing or redistributing this code until a license is established.
