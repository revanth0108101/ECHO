# ECHO — The Internet's Memory

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

## Runtime configuration

The managed Webdev deployment provides `DATABASE_URL` for persistent MySQL and the Manus OAuth/session variables (`MANUS_PROJECT_ID`, `MANUS_JWT_SECRET`, and `MANUS_OAUTH_API_URL`). Do not add these values to client code or commit them. The optional server-side AI connection uses `MANUS_API_URL` and `MANUS_API_KEY`; if either is unavailable, ECHO uses visibly labelled demo intelligence. The server honors `PORT` and defaults to `3000`.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.
