# ECHO — The Internet's Memory

## Product and implementation plan

ECHO is a responsive, dark-first personal knowledge workspace for saving digital memories, connecting them, and recalling them with source-grounded AI. The managed Webdev project uses its existing React 19 + TypeScript + Vite client, Express/tRPC server, Drizzle ORM and managed MySQL database. The checked-in dependency lock and starter are retained. Memory records, relationships, and collections live in MySQL; Drizzle schema and migrations define them, typed tRPC procedures implement CRUD/search/analytics/AI server calls, and the browser never receives server credentials. Client-side routing uses the starter's Wouter setup and React Query/tRPC provider. A graph view uses a dedicated graph visualization library with persisted edges as its source of truth. Keep the platform-provided Manus chat-completions service as the live-AI integration, with deterministic, plainly labelled demo intelligence whenever required credentials or service calls are unavailable; do not represent the demo as live AI. Search is keyword/tag/category-based with a clearly bounded future semantic-search option (semantic search is available only once embeddings are configured). Seed exploration memories once, without overwriting user edits on restart. No public release credentials or claims of production authentication are assumed.

### Project structure

- `client/src/App.tsx`, `client/src/pages/`, `client/src/components/`: route shell, workspace navigation and dashboard, memories, graph, recall, timeline, collections and settings pages.
- `client/src/lib/`: tRPC client and small formatting/search helpers.
- `client/src/index.css`: ECHO design tokens, dark theme, responsive layout, graph and motion styles.
- `server/routers.ts`: typed memory, collection, search, graph, analytics and recall/intelligence endpoints.
- `server/db.ts`: MySQL/Drizzle persistence queries and idempotent starter-data initialization.
- `drizzle/schema.ts`, `drizzle/`: users (starter auth table), memories, directed/undirected normalized memory links, collections and memory-collection joins; additive schema migration(s).
- `public/manus-routes.json`: declared app page routes, kept synchronized with source.
- `plan.md`, `TODO.md`: approved implementation/design and complete acceptance clauses/status.

## Design

**Design Movement:** Quietly futuristic editorial software, borrowing the precision of Linear and the expressive spatial feel of a research instrument without copying either.

**Core Principles:** (1) The saved knowledge is the hero; chrome stays calm. (2) Spatial connections are legible at a glance. (3) Every AI claim has visible provenance or a demo label. (4) Capture and recall stay one action away.

**Color Philosophy:** Midnight ink and layered charcoal create a focused archive; one ownable ultraviolet-cyan signal marks active knowledge and AI, while muted blue and orchid distinguish topic clusters. Color is semantic rather than ornamental, and text contrast remains high.

**Layout Paradigm:** An anchored, narrow navigation rail opens into a fluid editorial workspace. The dashboard uses asymmetrical information bands rather than equal cards: a welcoming search/capture masthead, a wide graph preview beside a narrow activity column, then recent memories and topic clusters. On small screens the rail becomes a compact top bar and content stacks without horizontal overflow.

**Signature Elements:** A small ultraviolet-to-cyan echo-ring mark (overlapping memory ripples); hairline connection paths and softly glowing graph nodes; a slim vertical signal line for chronological memory history.

**Interaction Philosophy:** Direct, reversible, and source-aware. Capture dialogs validate before save; cards open readable detail/edit views; deletion gets a deliberate confirmation; graph nodes open their saved source; search and filters update real results; empty/loading/error states explain the next useful action.

**Animation:** Short 160–240 ms ease-out transitions for view changes, hover and drawer reveal; restrained node pulse on selection and a gentle one-time entrance for key content. Respect `prefers-reduced-motion`. Avoid ambient motion that distracts from reading.

**Typography System:** Inter (or a close system sans fallback) for UI and body, with a restrained medium-weight display scale for page headings; compact monospaced labels only for metadata such as dates and source domains. Clear 12/14/16/24/32 px hierarchy; generous line-height for memory text.

**Brand Essence:** A private-feeling map of the things you have learned, saved for people who collect knowledge across the web; different because it reconnects saved fragments instead of leaving them in a pile. Personality: lucid, curious, composed.

**Brand Voice:** Concise, warm, observant; never pretend the assistant remembers something not in the archive. Headlines and CTAs use active verbs. Examples: “Your ideas are finding each other.” “Save a thought. Keep its context.”

**Wordmark & Logo:** A custom ECHO wordmark paired with three offset, open concentric arcs whose gaps suggest an echo returning; the compact mark uses only those arcs.

**Signature Brand Color:** Echo ultraviolet `#9B8CFF`, paired with electric cyan `#57D8E8` for connected states.

## Application behavior

- All seven requested navigation destinations are implemented as working app pages: Dashboard, All Memories, Knowledge Graph, AI Recall, Timeline, Collections and Settings.
- The dashboard's statistics, recent activity, recent memories, common topics and graph preview derive from persistent records and relationships, not hardcoded dashboard totals.
- Memory capture/edit handles text, URL, note and image/screenshot metadata plus title, content, source, date, category and tags. CRUD validates fields and preserves creation date on edits.
- Persisted relationships drive both the graph and related-memory lists. The graph supports zoom/pan and selectable nodes, with grouped topic presentation and a detail affordance.
- Keyword search and category/tag filters are functional and highlight matching text. Semantic search is not claimed unless embeddings are configured.
- Timeline is chronological and exposes saved dates and memory topics.
- Recall sends only the user's question and relevant saved memory excerpts to the server-side platform LLM when available; answers expose source memories. Deterministic local/demo recall is visibly marked when live AI is unavailable and never fabricates a live response.
- Helpful initial sample content is seeded idempotently and does not reset edited user records after restart.
- Responsive behavior, loading, error, validation and empty states are included. User-facing destructive actions are deliberate.

## Platform and material constraints

- Project initialized with managed server and MySQL database; dev and published deployment share that DB. Schema migration and one-time seed behavior must therefore be additive/idempotent and no testing action may wipe it.
- Live AI uses `MANUS_API_URL` and `MANUS_API_KEY` from the server process at call time. No AI secret is emitted to browser code. On missing configuration or service failure the UI explicitly indicates demo intelligence.
- Package manager is pinned to pnpm 10.18.0. Keep lifecycle policy in the existing `pnpm-workspace.yaml`; verify dependencies and TypeScript/build using starter commands.
- Declare the full static page route manifest before the first dev-server launch. Run the dev server through Webdev `runtime/dev-commands`, on its configured port.
- No deployment is assumed; publication is separate. Retain/adjust only valid starter deployment defaults unless explicitly publishing is requested.


## Privacy architecture refinement

ECHO memories contain personal notes and browsing context, so the workspace now uses the existing Manus OAuth session before showing private data. The starter's real signed-in identity is resolved by its authenticated tRPC context; all memory/collection/AI procedures use `protectedProcedure`, and SQL queries scope reads and writes to the signed-in `users.id`. New memories/collections carry that owner foreign key; graph links are accepted only between records belonging to that same owner. Signed-out visitors see an explicit sign-in screen. Initial sample records are seeded once per account with stable seed keys, without overwriting edited records or restoring user-deleted samples. The starter's fixed `webdev_app_session` cookie and `SameSite=None; Secure` Preview behavior remain intact.
