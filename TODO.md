# ECHO delivery outcomes

## Existing completed outcomes — preserve while upgrading

### Persistent memory capture and management
- [x] Users can save text, URLs, notes, images, and screenshots.
- [x] Every memory contains a title, content, source, creation date, category, tags, and related memories.
- [x] Provide a beautiful capture interface.
- [x] Users can create, edit, view, search, and delete memories.
- [x] Data persists after refreshing the page.
- [x] Keep the personal archive empty until the user saves content; offer clearly labeled synthetic demo content only after explicit selection.
- [x] Provide proper error handling, loading states, empty states, and form validation.

### Workspace dashboard and navigation
- [x] Create a dashboard containing a welcome section, global search bar, total memories saved, knowledge connections count, recent activity, recently captured memories, most frequently discussed topics, interactive knowledge graph preview, and quick capture button.
- [x] Do not hardcode dashboard statistics when real database values are available.
- [x] All navigation works for Dashboard, All Memories, Knowledge Graph, AI Recall, Timeline, Collections, and Settings.
- [x] All buttons perform their intended actions; do not leave fake buttons or decorative controls.
- [x] The application works on different screen sizes.

### AI intelligence and recall
- [x] Integrate an LLM API through a secure server-side endpoint.
- [x] AI summarizes saved content, extracts important concepts, generates tags, categorizes memories, and identifies relationships between memories.
- [x] Never expose API keys in frontend code.
- [x] If an API key is unavailable, implement functional demo mode with clearly labelled sample intelligence rather than pretending live AI is working.
- [x] Create a conversational interface for questions such as “What did I learn about machine learning last month?”, “Show me everything connected to neural networks”, “Where did I save that website about cybersecurity?”, and “Explain how my saved notes about AI are connected.”
- [x] Answers are grounded in saved memories and show relevant source memories with each answer.

### Knowledge graph
- [x] Build an interactive graph where each memory is represented by a node and related memories are connected by edges.
- [x] Users can zoom and pan; clicking a node opens its memory.
- [x] Related concepts are visually grouped and users can explore their knowledge network.
- [x] The graph uses actual stored memory relationships.

### Search and timeline
- [x] Implement keyword search, tag filtering, category filtering, and search results with highlighted relevant information.
- [ ] Provide semantic search when embeddings are configured. Keep this open and explicitly gated until a documented embedding provider and compatible retrieval path are confirmed; do not represent keyword matching as semantic search.
- [x] Create a chronological memory timeline users can explore to see what they saved, when they saved it, which topics they explored, and how their knowledge evolved over time.

### Collections and settings
- [x] Provide functional Collections and Settings destinations in the navigation.

### Product quality and delivery preparation
- [x] Build the application, not merely a design mockup or landing page.
- [x] Use a clean, maintainable project structure; preferred stack is Next.js, React, TypeScript, Tailwind CSS, SQLite or another suitable persistent database, a suitable graph visualization library, server-side AI integration, and proper API routes. (The managed project starter supplies React/TypeScript/Tailwind, Express/tRPC, Drizzle and MySQL.)
- [x] Prioritize functionality, originality, exceptional design, and a polished user experience.
- [ ] Test all major user flows and fix errors before declaring completion.
- [x] If deployment is supported, prepare it for deployment and explain any required environment variables.

### Private account-scoped workspace
- [x] Use the real Manus OAuth flow; show a signed-out state until the session is verified.
- [x] Every memory, collection, relationship, AI enrichment and recall request is authenticated and restricted to the signed-in account.
- [x] Preserve existing seeded/sample rows and edits without automatic deletion or overwrite; keep legacy rows out of ordinary personal reads and allow owner-scoped review/promotion.

## Approved upgrade outcomes

### Stage 1 — Universal capture and persistent extraction
- [ ] Preserve working website/URL, text, personal note, image, and screenshot capture. Add supported PDFs and other supported documents, and YouTube links with available transcripts.
- [ ] Provide a simple manual capture interface. For each saved item, extract and persist available title, description, main content, key concepts, topics/tags, source URL, and capture date.
- [ ] Show real processing, success, and failure states for extraction. Do not claim that a URL or file was successfully processed when extraction failed; preserve the saved item and report an honest retryable status.
- [ ] Store attachment metadata and extracted text/chunks persistently, keep binary payloads out of ordinary library-list responses, and provide an owner-authorized path for opening/downloading originals. Do not expose private credentials or temporary signed URLs in browser code or logs.
- [ ] Capture a YouTube URL and available transcript only when a supported, permitted transcript source succeeds; otherwise preserve the link and clearly offer manual transcript input.
- [ ] Before saving, detect an existing normalized URL and warn about an exact URL duplicate. Do not merge or delete content automatically.
- [ ] Apply bounded, idempotent extraction/indexing; avoid duplicate or unnecessary AI calls for unchanged content and handle interrupted work, size/type limits, parser failures, and provider errors without losing the saved item.

### Stage 1 — Unified search and Ask My Memory
- [ ] Search saved notes and extracted document content with keyword search, topic/type/date filters, and concise explanations of why each result matched.
- [ ] Keep keyword retrieval functional regardless of embedding availability. Enable semantic search only after a documented embedding provider and compatible vector storage/query path have been confirmed; until then, label semantic search as unavailable/not configured and do not imply the keyword fallback is semantic.
- [ ] Retrieve relevant owner-scoped saved content before generating assistant answers. Ground answers in retrieved sources, never pretend the archive contains information it does not contain, and clearly distinguish archive-grounded content from general AI knowledge.
- [ ] Persist conversation history and source references. Include clickable citations that open the referenced saved item; keep conversation history private to its owning account.
- [ ] Handle missing/empty AI responses and provider failures gracefully, preserve user input for retry, and clearly label any deterministic/demo behavior rather than presenting it as live AI.

### Stage 2 — Explainable interactive knowledge graph
- [ ] Represent every saved item as a graph node and retain current pan, zoom, selection, manual links, and node-to-memory opening behavior.
- [ ] Identify related items across websites, notes, PDFs, images, and other supported content. Use AI-generated embeddings and semantic similarity only when the embedding provider is confirmed and configured; keep semantic-dependent controls explicitly gated until then.
- [ ] Display why two items are connected and distinguish manual links, supported AI suggestions, and embedding-derived relationships. Avoid meaningless or weak connections; automatic edges remain reviewable and must not silently replace or remove manual links.
- [ ] Allow users to click a node and open its original saved content, explore connections between topics, and filter by topic, content type, and connection strength.
- [ ] Persist relationship origin, explanation, confidence/strength, and review status with account-scoped authorization.

### Stage 3 — Intelligent collections and duplicate/similarity review
- [ ] Automatically suggest collections based on the account’s saved content while allowing manual collection creation and user-controlled acceptance, rename, dismissal, and item moves.
- [ ] Avoid unnecessary duplicate collections; show related topics and item counts. Persist user-approved collection organization.
- [ ] Detect exact duplicate URLs/content deterministically and show possible duplicates before saving. Show semantic-similarity candidates only when embeddings are configured; do not disguise exact/keyword matching as semantic similarity.
- [ ] Offer to connect a new item to an existing item when appropriate. Never merge or delete user content without explicit permission.

### Stage 4 — Knowledge Gaps, richer timeline, and optional daily recap
- [ ] Add an experimental Knowledge Gaps feature that analyzes topics in the saved collection and identifies topics with little saved information, related subjects not explored in the archive, questions that could deepen understanding, and connections worth investigating.
- [ ] Generate exploration questions from actual saved content and describe gaps as low coverage in the archive; do not make unsupported assumptions about the user’s knowledge.
- [ ] Extend the timeline to include recently saved items, previously explored topics, new connections discovered, recently active collections, and important older content. Allow filtering by date, topic, and content type.
- [ ] Add an optional, persisted daily memory recap containing recently saved information, important extracted ideas, interesting connections, relevant older information, and suggested topics to explore.
- [ ] Keep recap/notification behavior opt-in. Daily recap is off by default and in-app only; do not send notifications unless the user explicitly enables a supported notification channel.

### Cross-cutting UI redesign and existing-feature preservation
- [ ] Redesign the actual existing application, not only a landing page or static mockup. Preserve ECHO’s visual identity and dark theme while adding a polished light theme and an accessible theme toggle.
- [ ] Rework dashboard layout, navigation, search experience, graph presentation, AI chat, collection management, and empty/loading/error states without replacing working functionality with mockups.
- [ ] Provide a sleek collapsible desktop sidebar with Overview, My Memory, Knowledge Graph, Collections, AI Assistant, Knowledge Gaps, and Timeline; provide Settings, Profile, and theme controls in the bottom section. Profile/account controls must use the actual authenticated account, not placeholder data.
- [ ] Include a personalized greeting, global search, quick capture, total saved memories, connections discovered, active collections, recently saved content, archive-derived AI insights, and suggested topics. Metrics and insights must be based on persistent user data, not hardcoded sample-only controls.
- [ ] Use a mobile navigation system instead of squeezing the desktop sidebar onto small screens. Support desktop, laptop, tablet, and mobile layouts with readable content, predictable scroll behavior, and no unintended horizontal overflow.
- [ ] Use clean typography (Manrope-style interface and DM Mono-style technical metadata where available), subtle fast animations, polished focus/hover/loading feedback, sufficient contrast in both themes, comfortable touch targets, and reduced-motion support. Avoid excessive gradients, clutter, random decoration, and unnecessary neon effects.
- [ ] Ensure every new control performs its intended real action or clearly states why the capability is unavailable; do not leave fake buttons or decorative functionality.

### Persistence, privacy, migrations, and staged delivery
- [ ] Preserve the existing React + TypeScript + Vite, tRPC backend, authentication, database, and working functionality. Keep API keys server-side and ensure users can access only their own private knowledge, files, conversations, relationships, collections, and generated insights.
- [ ] Inspect/extend the existing database schema through safe additive migrations; persist saved items, collections, connections, conversations, relevant suggestions, extraction/index status, and recap data. Preserve existing records and user edits; do not reset or overwrite user data.
- [ ] Treat URL import as an untrusted network boundary: restrict schemes/redirects and reject private/loopback/link-local destinations; enforce size, MIME, and time limits; report extraction failure honestly.
- [ ] Use background processing only where appropriate for expensive extraction/indexing; make it idempotent and resumable. Handle AI/provider errors gracefully and avoid unnecessary repeated calls or embedding generation.
- [ ] After each approved stage, exercise the changed functionality, fix errors, verify persistence, and verify existing functionality still works. Use safe fixtures/mocks for new create/delete or AI flows; do not write/delete live account data or submit AI queries over personal saved memories during QA without authorization.
- [ ] Keep the separate GitHub connection request pending until the user supplies the exact owner/repository and confirms the destination. Do not transfer code or change the canonical repository before that confirmation.


## Production-readiness and quality upgrade outcomes

### Empty personal archive and explicitly selected demo mode
- [x] New accounts start with a genuinely empty personal archive; ordinary authenticated list, collection, enrichment, and recall reads do not automatically insert sample memories or collections.
- [x] Demo/sample memories are available only through an explicitly selected demo mode, are clearly distinguished from personal user data, and are never silently mixed into the user’s personal archive, search results, graph, collections, or recall context.
- [x] Preserve existing seeded/sample rows and any user edits; do not automatically delete, overwrite, or bulk-convert legacy records. Provide an owner-scoped, explicit way to review or keep/promote legacy sample content without losing it.
- [x] Empty personal archive states remain useful and attractive and offer a clearly labeled optional demo path.

### Server-side validation, upload security, and privacy
- [x] Validate user inputs on the server for create, update, delete, collections, links, conversations, search, and other exposed mutations; browser checks are additional UX, not the security boundary.
- [x] Validate uploaded image bytes against explicit allowed image-format signatures, reject malformed or mismatched content, and enforce decoded-size/pixel and request-body limits server-side that match the advertised upload limit.
- [x] Do not return binary attachment payloads with ordinary memory-list responses. Fetch/open an original only through an authenticated, owner-checked path; do not expose credentials, private configuration, or temporary signed URLs to the browser or logs.
- [x] Scope reads and writes for memories, conversations, files, collections, memberships, citations, and relationships to the authenticated owner; validate ownership before mutations and relationship changes.
- [ ] Preserve and verify Manus OAuth and session handling. Keep API keys, database credentials, signing secrets, and private configuration server-side; return user-safe errors rather than sensitive internal details.

### Recall, memory management, and data integrity
- [x] Retrieve relevant owner-scoped memories before AI generation, improve lexical ranking for short technical terms, bound context, and avoid sending images or complete records unless required by a supported feature.
- [x] Return lightweight retrieval/source information; show the actual validated memories used to generate each answer, distinguish citations from merely retrieved candidates, and never fabricate memories, links, or citations.
- [x] Clearly distinguish live AI, deterministic demo intelligence, and legacy answers whose generation mode is unknown. If context is insufficient or the provider fails/returns empty output, say so honestly and retain the user’s question for retry.
- [x] Persist conversation history and source provenance, and prevent an in-flight response from switching the user away from a conversation they selected.
- [ ] Test memory creation, editing, deletion, favorites if implemented, collection create/manage, search/filter, link/note saving, memory details, related memories, and persistence after refresh. Do not claim a favorite feature works if the product does not implement it.
- [x] Prevent duplicate/self/inconsistent links; make multi-table memory, membership, relationship, and recall turn writes transactional. Validate all requested collection IDs before modifying memberships, and never leave prior memberships silently cleared after invalid input.

### Knowledge graph, performance, and error recovery
- [ ] Ensure graph nodes are real saved memories, relationships reference existing owner-authorized records, duplicate/self-links are prevented, and no unsupported relationship is invented. Preserve node selection/opening, pan/zoom, and meaningful empty/loading states.
- [ ] Improve readability and interaction for larger graphs without removing existing functionality. Use pagination, bounded loading, indexes, or query/data-structure changes only where appropriate and supported by the existing UI/data shape.
- [ ] Avoid unnecessary requests and React re-renders; do not retrieve an entire archive or all attachment bytes when only a bounded subset or selected detail is required.
- [ ] Provide clear loading, error, retry, empty-search, and expired-session recovery for failed saves, image uploads, AI calls, database operations, and network interruptions. Avoid silent failures and preserve user input when retry is possible.

### Tests, documentation, and visual quality
- [x] Run the existing type checks, test suite, and production build; fix errors introduced by the upgrade and report only tests actually executed.
- [ ] Add automated coverage for memory CRUD, owner isolation, collections/memberships, graph links, and AI recall using mocked repositories, synthetic fixtures, and stubbed provider responses. Tests must not write/delete live managed records or submit AI queries over personal saved memories.
- [x] Improve README coverage of what ECHO is, the problem it solves, features, stack, architecture, installation, environment variables, database setup, development/production commands, screenshots, and future improvements.
- [x] Remove the unsupported `package.json` license declaration because no LICENSE file establishes terms; do not assert a license or add unverified copyright terms.
- [ ] Preserve the current dark visual theme, identity, navigation, pages, animations, and interactions; refine only genuine inconsistencies in spacing, typography, responsive behavior, button/input states, loading/empty/error states, modal behavior, and accessibility.
- [ ] Confirm changed flows remain responsive on desktop/mobile; support keyboard/focus behavior, sufficient contrast, and reduced motion without adding unnecessary visual effects or fake controls.
