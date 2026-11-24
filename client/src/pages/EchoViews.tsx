import { useMemo, useRef, useState, type FormEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BookmarkPlus, CalendarDays, Check, ChevronDown, Clock3, Command,
  FileImage, FileText, Filter, FolderPlus, Globe2, Link2, MessageCircle, Network, Plus, Search, Send, Sparkles,
  Tag, Trash2, Upload, UserRound, X,
} from "lucide-react";
import GraphCanvas from "@/components/GraphCanvas";
import { CATEGORY_OPTIONS, type CollectionRecord, type LegacySampleRecord, type MemoryRecord } from "@/lib/echo";
import { trpc } from "@/lib/trpc";

type BaseActions = { onOpen: (memory: MemoryRecord) => void };
const colors = ["#9b8cff", "#57d8e8", "#7caeff", "#e9a9ff", "#f0b96e", "#81ddb5"];
const categoryColor = (category: string) => colors[[...CATEGORY_OPTIONS, "Ideas & notes"].indexOf(category) % colors.length] ?? colors[0]!;
const savedDate = (date: Date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);

function IconFor({ type }: { type: MemoryRecord["sourceType"] }) {
  if (type === "url") return <Globe2 size={14} />;
  if (type === "image" || type === "screenshot") return <FileImage size={14} />;
  if (type === "text") return <BookmarkPlus size={14} />;
  return <FileText size={14} />;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const clean = query.trim();
  if (!clean) return <>{text}</>;
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return <>{parts.map((part, index) => part.toLowerCase() === clean.toLowerCase() ? <mark key={index}>{part}</mark> : part)}</>;
}

function SectionTitle({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="view-heading"> <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{detail && <p>{detail}</p>}</div>{action && <div className="view-heading-action">{action}</div>}</div>;
}

function MemoryCard({ memory, onOpen, query = "" }: BaseActions & { memory: MemoryRecord; query?: string }) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const reasons = terms.length ? [
    ...(terms.some((term) => memory.title.toLowerCase().includes(term)) ? ["title"] : []),
    ...(terms.some((term) => memory.content.toLowerCase().includes(term)) ? ["saved content"] : []),
    ...(terms.some((term) => `${memory.tags.join(" ")} ${memory.keyConcepts.join(" ")}`.toLowerCase().includes(term)) ? ["topics/tags"] : []),
    ...(terms.some((term) => `${memory.source ?? ""} ${memory.sourceUrl ?? ""}`.toLowerCase().includes(term)) ? ["source"] : []),
  ] : [];
  return <button type="button" className="memory-card" onClick={() => onOpen(memory)}>
    <div className="memory-card-top"><span className="memory-type"><IconFor type={memory.sourceType} />{memory.sourceType === "url" ? "Link" : memory.sourceType === "note" ? "Note" : memory.sourceType === "screenshot" ? "Screenshot" : memory.sourceType === "image" ? "Image" : "Clip"}</span><span className="memory-date">{savedDate(memory.createdAt)}</span></div>
    <h3><Highlight text={memory.title} query={query} /></h3>
    <p className="memory-excerpt"><Highlight text={memory.summary || memory.content} query={query} /></p>
    {reasons.length > 0 && <span className="match-explanation">Matched in {reasons.join(", ")}</span>}
    <div className="memory-card-bottom"><span className="category-dot" style={{ background: categoryColor(memory.category) }} /><span className="memory-category">{memory.category}</span>{memory.relatedIds.length > 0 && <span className="connection-count"><Network size={12} /> {memory.relatedIds.length}</span>}</div>
    {memory.tags.length > 0 && <div className="memory-tags">{memory.tags.slice(0, 3).map((tag) => <span className="tag-pill" key={tag}>{tag}</span>)}</div>}
  </button>;
}

function GraphPreview({ memories, onOpen }: BaseActions & { memories: MemoryRecord[] }) {
  const shown = memories.slice(0, 9);
  const points = shown.map((_, index) => ({ x: 70 + ((index * 137 + (index % 2) * 54) % 420), y: 36 + ((index * 73 + 26) % 132) }));
  return <div className="graph-preview-area"><svg viewBox="0 0 560 220" role="img" aria-label="Preview of the connected memories in your knowledge graph">
    <defs><radialGradient id="graphGlow"><stop offset="0" stopColor="#8171ff" stopOpacity=".24" /><stop offset="1" stopColor="#8171ff" stopOpacity="0" /></radialGradient></defs>
    <ellipse cx="280" cy="110" rx="242" ry="103" fill="url(#graphGlow)" />
    {shown.flatMap((memory, index) => memory.relatedIds.map((relatedId) => {
      const target = shown.findIndex((item) => item.id === relatedId);
      if (target < 0 || target <= index) return null;
      const color = categoryColor(memory.category);
      return <line key={`${memory.id}-${relatedId}`} x1={points[index]?.x} y1={points[index]?.y} x2={points[target]?.x} y2={points[target]?.y} stroke={color} strokeOpacity=".42" strokeWidth="1.3" />;
    }))}
    {shown.map((memory, index) => {
      const point = points[index]!; const color = categoryColor(memory.category);
      return <g key={memory.id} className="preview-node" role="button" tabIndex={0} aria-label={`Open ${memory.title}`} onClick={() => onOpen(memory)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(memory); }}>
        <circle cx={point.x} cy={point.y} r="13" fill={color} fillOpacity=".1" stroke={color} strokeOpacity=".65" />
        <circle cx={point.x} cy={point.y} r="4.6" fill={color} />
        <text x={point.x + 12} y={point.y - 11} fill="#b8b6ca" fontSize="9">{memory.title.length > 21 ? `${memory.title.slice(0, 20)}…` : memory.title}</text>
      </g>;
    })}
  </svg><div className="graph-preview-legend">{[...new Set(shown.map((memory) => memory.category))].slice(0, 4).map((category) => <span key={category}><i style={{ background: categoryColor(category) }} />{category}</span>)}</div></div>;
}

export function DashboardView({ memories, collections, onOpen, onCapture, onNavigate, onSearch }: BaseActions & {
  memories: MemoryRecord[]; collections: CollectionRecord[]; onCapture: () => void; onNavigate: (path: string) => void; onSearch: (query: string) => void;
}) {
  const countConnections = memories.reduce((total, memory) => total + memory.relatedIds.length, 0) / 2;
  const topics = useMemo(() => {
    const tally = new Map<string, number>();
    memories.forEach((memory) => memory.tags.forEach((tag) => tally.set(tag, (tally.get(tag) ?? 0) + 1)));
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [memories]);
  const recent = memories.slice(0, 4);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return <div className="dashboard-view">
    <div className="dash-welcome"><div className="welcome-orbit"><span /><i /></div><div className="welcome-copy"><span className="eyebrow">YOUR PERSONAL KNOWLEDGE SPACE</span><h1>{greeting}. <em>Keep the thread.</em></h1><p>Your ideas are finding each other. Pick up where curiosity left off.</p></div><button className="button button-primary welcome-capture" onClick={onCapture}><Plus size={16} /> Capture a memory</button></div>
    <div className="dash-stats">
      <button className="stat-card" onClick={() => onNavigate("/memories")}><span className="stat-icon violet"><BookmarkPlus size={16} /></span><span className="stat-copy"><small>MEMORIES</small><strong>{memories.length.toLocaleString()}</strong><em>things worth keeping</em></span><ArrowUpRight className="stat-arrow" size={16} /></button>
      <button className="stat-card" onClick={() => onNavigate("/graph")}><span className="stat-icon cyan"><Network size={16} /></span><span className="stat-copy"><small>CONNECTIONS</small><strong>{countConnections.toLocaleString()}</strong><em>bridges between ideas</em></span><ArrowUpRight className="stat-arrow" size={16} /></button>
      <button className="stat-card" onClick={() => onNavigate("/collections")}><span className="stat-icon rose"><FolderPlus size={16} /></span><span className="stat-copy"><small>ACTIVE SHELVES</small><strong>{collections.filter((collection) => collection.memoryIds.length > 0).length.toLocaleString()}</strong><em>collections in use</em></span><ArrowUpRight className="stat-arrow" size={16} /></button>
      <button className="stat-card" onClick={() => onNavigate("/timeline")}><span className="stat-icon blue"><Tag size={16} /></span><span className="stat-copy"><small>TOPICS</small><strong>{topics.length.toLocaleString()}</strong><em>threads you've started</em></span><ArrowUpRight className="stat-arrow" size={16} /></button>
    </div>
    <div className="dashboard-columns">
      <section className="surface graph-preview-card"><div className="surface-heading"><div><span className="eyebrow">THE BIGGER PICTURE</span><h2>Your knowledge map</h2></div><button className="subtle-link" onClick={() => onNavigate("/graph")}>Explore graph <ArrowRight size={14} /></button></div><GraphPreview memories={memories} onOpen={onOpen} /></section>
      <section className="surface activity-card"><div className="surface-heading"><div><span className="eyebrow">IN MOTION</span><h2>Recent activity</h2></div><Clock3 size={16} className="muted-icon" /></div>
        <div className="activity-list">{recent.length ? recent.map((memory, index) => <button key={memory.id} className="activity-row" onClick={() => onOpen(memory)}><span className={`activity-marker marker-${index % 4}`}><IconFor type={memory.sourceType} /></span><span className="activity-body"><strong>{memory.title}</strong><small>{memory.source || memory.category}</small></span><span className="activity-time">{formatDistanceToNow(memory.createdAt, { addSuffix: true })}</span></button>) : <div className="empty-inline">No activity yet. Capture your first memory.</div>}</div>
      </section>
    </div>
    <div className="dashboard-columns lower-columns">
      <section className="surface recent-card"><div className="surface-heading"><div><span className="eyebrow">JUST CAPTURED</span><h2>Recent memories</h2></div><button className="subtle-link" onClick={() => onNavigate("/memories")}>View all <ArrowRight size={14} /></button></div><div className="recent-memory-list">{recent.slice(0, 3).map((memory) => <button key={memory.id} onClick={() => onOpen(memory)} className="recent-memory-row"><span className="recent-memory-symbol" style={{ color: categoryColor(memory.category) }}><IconFor type={memory.sourceType} /></span><span className="recent-memory-copy"><strong>{memory.title}</strong><small>{memory.category} · {savedDate(memory.createdAt)}</small></span><ArrowUpRight size={14} /></button>)}{!recent.length && <div className="empty-inline">Your saved ideas will show up here.</div>}</div></section>
      <section className="surface topics-card"><div className="surface-heading"><div><span className="eyebrow">WHAT KEEPS COMING UP</span><h2>Frequent topics</h2></div><Tag size={16} className="muted-icon" /></div><div className="topic-cloud">{topics.length ? topics.map(([topic, amount], index) => <button key={topic} className={`topic-chip topic-${index % 4}`} onClick={() => { onSearch(topic); onNavigate("/memories"); }}><span>{topic}</span><small>{amount}</small></button>) : <p className="muted-copy">Tags from your memories will surface here.</p>}</div><button className="topic-search-link" onClick={() => onNavigate("/memories")}>Find a thread <ArrowDownRight size={14} /></button></section>
    </div>
  </div>;
}

export function LibraryView({ memories, onOpen, onCapture, query, setQuery, legacySampleCount, onReviewLegacy }: BaseActions & {
  memories: MemoryRecord[]; onCapture: () => void; query: string; setQuery: (value: string) => void; legacySampleCount: number; onReviewLegacy: () => void;
}) {
  const [demoMode, setDemoMode] = useState(false);
  const demoQuery = trpc.memories.demo.useQuery(undefined, { enabled: demoMode, retry: 1, staleTime: Infinity });
  const [category, setCategory] = useState("All categories");
  const [tag, setTag] = useState("All tags");
  const [type, setType] = useState("All types");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const allTags = useMemo(() => [...new Set(memories.flatMap((memory) => memory.tags))].sort((a, b) => a.localeCompare(b)), [memories]);
  const categories = useMemo(() => [...new Set(memories.map((memory) => memory.category))].sort(), [memories]);
  const filtered = useMemo(() => memories.filter((memory) => {
    const q = query.trim().toLowerCase();
    const day = memory.createdAt.toISOString().slice(0, 10);
    const searchable = [memory.title, memory.content, memory.summary ?? "", memory.category, memory.source ?? "", memory.sourceUrl ?? "", ...memory.tags, ...memory.keyConcepts].join(" ").toLowerCase();
    return (category === "All categories" || memory.category === category) && (tag === "All tags" || memory.tags.includes(tag)) && (type === "All types" || memory.sourceType === type) && (!fromDate || day >= fromDate) && (!toDate || day <= toDate) && (!q || searchable.includes(q));
  }), [memories, category, tag, type, fromDate, toDate, query]);
  const activeFilters = (category !== "All categories" ? 1 : 0) + (tag !== "All tags" ? 1 : 0) + (type !== "All types" ? 1 : 0) + (fromDate ? 1 : 0) + (toDate ? 1 : 0);
  const clearFilters = () => { setCategory("All categories"); setTag("All tags"); setType("All types"); setFromDate(""); setToDate(""); };
  if (demoMode) return <div className="library-view demo-archive-view">
    <SectionTitle eyebrow="SEPARATE · READ-ONLY EXAMPLE DATA" title="Demo archive" detail="These curated examples are not saved to your account and never appear in your personal search, graph, collections, or recall." action={<button className="button button-quiet" onClick={() => setDemoMode(false)}>Back to my archive</button>} />
    {demoQuery.isLoading && <div className="thinking" role="status"><span /><span /><span /> Loading demo examples…</div>}
    {demoQuery.isError && <div className="app-error-inline" role="alert"><p>Demo examples could not be loaded. Your personal archive is unchanged.</p><button className="button button-quiet" onClick={() => void demoQuery.refetch()}>Try again</button></div>}
    {demoQuery.data && <div className="memory-grid">{demoQuery.data.map((memory) => <article key={memory.id} className="memory-card demo-sample-card"><div className="memory-card-top"><span className="memory-type"><IconFor type={memory.sourceType} />Demo sample</span><span className="memory-date">{savedDate(memory.createdAt ?? new Date(0))}</span></div><h3>{memory.title}</h3><p className="memory-excerpt">{memory.summary || memory.content}</p>{memory.sourceUrl && <a href={memory.sourceUrl} target="_blank" rel="noreferrer" className="subtle-link">Open example source <ArrowUpRight size={13} /></a>}<div className="memory-card-bottom"><span className="category-dot" style={{ background: categoryColor(memory.category) }} /><span className="memory-category">{memory.category}</span></div><div className="memory-tags">{memory.tags.slice(0, 3).map((tag) => <span className="tag-pill" key={tag}>{tag}</span>)}</div></article>)}</div>}
  </div>;
  return <div className="library-view">
    <SectionTitle eyebrow="YOUR MEMORY ARCHIVE" title="All memories" detail={`${memories.length} saved ${memories.length === 1 ? "memory" : "memories"} · every fragment has a place`} action={<div className="button-row"><button className="button button-quiet" onClick={() => setDemoMode(true)}>Explore demo archive</button><button className="button button-primary" onClick={onCapture}><Plus size={16} /> New memory</button></div>} />
    <div className="library-toolbar"><label className="library-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, notes, sources, tags…" /><kbd>↵</kbd>{query && <button type="button" className="clear-query" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label>
      <div className="filter-wrap"><button className={`button button-filter ${filterOpen || activeFilters ? "active" : ""}`} onClick={() => setFilterOpen(!filterOpen)}><Filter size={15} /> Filters{activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}<ChevronDown size={14} /></button>
        {filterOpen && <div className="filter-menu"><label>Topic / category<select value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Tag<select value={tag} onChange={(event) => setTag(event.target.value)}><option>All tags</option>{allTags.map((value) => <option key={value}>{value}</option>)}</select></label><label>Content type<select value={type} onChange={(event) => setType(event.target.value)}><option>All types</option>{["note", "text", "url", "image", "screenshot"].map((value) => <option key={value} value={value}>{value[0]!.toUpperCase() + value.slice(1)}</option>)}</select></label><div className="date-filter-row"><label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div><div className="filter-menu-bottom"><button onClick={clearFilters}>Reset</button><button className="button button-primary button-small" onClick={() => setFilterOpen(false)}>Done</button></div></div>}
      </div>
    </div>
    <div className="results-line"><span>{filtered.length} {filtered.length === 1 ? "result" : "results"}{query && <> for <strong>“{query}”</strong></>}</span><span className="search-type-label" title="Semantic search is gated until an embedding provider is configured"><Check size={12} /> Keyword search · semantic not configured</span></div>
    {filtered.length ? <div className="memory-grid">{filtered.map((memory) => <MemoryCard key={memory.id} memory={memory} onOpen={onOpen} query={query} />)}</div> : <div className="empty-state"><div className="empty-orb"><Search size={21} /></div><h2>{memories.length ? "No memories match those filters" : "Your archive is a blank page"}</h2><p>{memories.length ? "Try another phrase, category, or tag." : "Save a link, a thought, or an image and ECHO will keep it close."}</p>{memories.length ? <button className="button button-quiet" onClick={() => { setQuery(""); clearFilters(); }}>Clear filters</button> : <><button className="button button-primary" onClick={onCapture}><Plus size={15} /> Capture a memory</button><button className="button button-quiet" onClick={() => setDemoMode(true)}>Explore curated demo examples</button>{legacySampleCount > 0 && <button className="text-action" onClick={onReviewLegacy}>Review {legacySampleCount} preserved legacy sample {legacySampleCount === 1 ? "memory" : "memories"} in Settings</button>}</>}</div>}
  </div>;
}

export function KnowledgeGraphView({ memories, onOpen }: { memories: MemoryRecord[]; onOpen: (memory: MemoryRecord) => void }) {
  const groups = useMemo(() => [...new Set(memories.map((memory) => memory.category))], [memories]);
  const edges = memories.reduce((total, memory) => total + memory.relatedIds.length, 0) / 2;
  return <div className="graph-view"><SectionTitle eyebrow="YOUR IDEAS, IN RELATION" title="Knowledge graph" detail="Move through the archive. Follow the links. Find a new way in." action={<span className="graph-count-pill"><span />{memories.length} nodes · {edges} connections</span>} />
    <div className="graph-layout"><div className="graph-canvas-card"><div className="graph-canvas-heading"><span><Network size={15} /> Memory network</span><small>Drag to move · scroll to zoom · select a node to open it</small></div><GraphCanvas memories={memories} onOpen={onOpen} /></div>
      <aside className="graph-sidebar"><div className="graph-help"><span className="stat-icon violet"><Sparkles size={16} /></span><h3>Follow a thought.</h3><p>Every line is a connection saved in your archive. Zoom out to see the shape; zoom in to read the details.</p></div><div className="graph-legend"><h4>TOPIC CLUSTERS</h4>{groups.map((category) => <div className="legend-row" key={category}><i style={{ background: categoryColor(category) }} /><span>{category}</span><small>{memories.filter((memory) => memory.category === category).length}</small></div>)}{!groups.length && <p className="muted-copy">Clusters appear as you save memories.</p>}</div><div className="graph-hint"><span>01</span><p>Connections reflect related memories you saved or discovered through intelligence.</p></div></aside></div>
  </div>;
}

export function TimelineView({ memories, onOpen }: { memories: MemoryRecord[]; onOpen: (memory: MemoryRecord) => void }) {
  const sorted = useMemo(() => [...memories].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()), [memories]);
  const groups = useMemo(() => {
    const map = new Map<string, MemoryRecord[]>();
    for (const memory of sorted) { const key = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(memory.createdAt); map.set(key, [...(map.get(key) ?? []), memory]); }
    return [...map.entries()];
  }, [sorted]);
  const topicCount = (memory: MemoryRecord) => memory.tags.slice(0, 3);
  return <div className="timeline-view"><SectionTitle eyebrow="A HISTORY OF YOUR CURIOSITY" title="Your timeline" detail="A quiet record of what caught your attention, and when." action={<span className="timeline-total"><CalendarDays size={15} /> {memories.length} moments</span>} />
    {!sorted.length ? <div className="empty-state"><div className="empty-orb"><Clock3 size={21} /></div><h2>Your story begins with the first save.</h2><p>Captured memories will appear here, in order.</p></div> : <div className="timeline-list">{groups.map(([month, items]) => <section key={month} className="timeline-month"><div className="timeline-month-heading"><span>{month}</span><i /> <small>{items.length} {items.length === 1 ? "memory" : "memories"}</small></div><div className="timeline-events">{items.map((memory) => <button key={memory.id} className="timeline-event" onClick={() => onOpen(memory)}><span className="timeline-date">{new Intl.DateTimeFormat("en", { day: "2-digit" }).format(memory.createdAt)}<small>{new Intl.DateTimeFormat("en", { weekday: "short" }).format(memory.createdAt)}</small></span><span className="timeline-node" style={{ borderColor: categoryColor(memory.category) }}><i style={{ background: categoryColor(memory.category) }} /></span><span className="timeline-event-copy"><span className="timeline-event-meta">{memory.category} <b>·</b> {memory.source || memory.sourceType}</span><strong>{memory.title}</strong><small>{memory.summary || memory.content.slice(0, 150)}{memory.content.length > 150 ? "…" : ""}</small>{topicCount(memory).length > 0 && <span className="timeline-topics">{topicCount(memory).map((topic) => <em key={topic}>#{topic.replaceAll(" ", "-")}</em>)}</span>}</span><ArrowUpRight size={15} className="timeline-open" /></button>)}</div></section>)}</div>}
  </div>;
}

export function CollectionsView({ collections, memories, onOpen, onCreate, onDelete }: {
  collections: CollectionRecord[]; memories: MemoryRecord[]; onOpen: (memory: MemoryRecord) => void; onCreate: (name: string, description: string, color: string) => Promise<void>; onDelete: (collection: CollectionRecord) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false); const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [color, setColor] = useState("violet"); const [selected, setSelected] = useState<number | null>(null); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const current = collections.find((item) => item.id === selected);
  const entries = current ? memories.filter((memory) => current.memoryIds.includes(memory.id)) : [];
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!name.trim()) { setError("Choose a collection name."); return; } setSaving(true); setError(""); try { await onCreate(name.trim(), description.trim(), color); setName(""); setDescription(""); setCreating(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "Collection could not be created."); } finally { setSaving(false); } };
  return <div className="collections-view"><SectionTitle eyebrow="GIVE YOUR IDEAS A HOME" title="Collections" detail="A few intentional shelves, not another folder maze." action={<button className="button button-primary" onClick={() => setCreating(!creating)}>{creating ? <X size={15} /> : <FolderPlus size={15} />}{creating ? "Close" : "New collection"}</button>} />
    {creating && <form className="collection-create surface" onSubmit={submit}><div className="collection-create-mark"><FolderPlus size={18} /></div><div className="collection-form-fields"><label className="field-label">Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ideas to revisit" maxLength={120} /></label><label className="field-label">Description<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What belongs on this shelf?" maxLength={500} /></label><label className="field-label">Accent<select value={color} onChange={(event) => setColor(event.target.value)}><option value="violet">Violet</option><option value="cyan">Cyan</option><option value="blue">Blue</option><option value="rose">Rose</option><option value="amber">Amber</option></select></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary" type="submit" disabled={saving}>{saving ? "Creating…" : "Create collection"}</button></div></form>}
    {collections.length ? <div className="collection-grid">{collections.map((collection, index) => <article key={collection.id} className={`collection-card collection-color-${collection.color}`}><button className="collection-main" onClick={() => setSelected(selected === collection.id ? null : collection.id)}><span className="collection-art"><span /><i /><b /></span><span className="collection-info"><strong>{collection.name}</strong><small>{collection.description || "A collection of saved ideas."}</small><em>{collection.memoryIds.length} {collection.memoryIds.length === 1 ? "memory" : "memories"}</em></span><ArrowUpRight size={15} /></button><div className="collection-card-footer"><span className="collection-tiny-nodes">{collection.memoryIds.slice(0, 5).map((id, position) => <i key={id} style={{ background: colors[(index + position) % colors.length] }} />)}</span><button className="icon-button collection-delete" aria-label={`Delete ${collection.name}`} title="Delete collection" onClick={async () => { if (window.confirm(`Delete “${collection.name}”? Memories will remain in your archive.`)) await onDelete(collection); }}><Trash2 size={14} /></button></div></article>)}</div> : !creating && <div className="empty-state"><div className="empty-orb"><FolderPlus size={21} /></div><h2>Make a shelf for the things you return to.</h2><p>Collections bring related saved memories into one place.</p><button className="button button-primary" onClick={() => setCreating(true)}><Plus size={15} /> Create a collection</button></div>}
    {current && <section className="collection-contents surface"><div className="surface-heading"><div><span className="eyebrow">COLLECTION SHELF</span><h2>{current.name}</h2></div><button className="icon-button" aria-label="Close collection contents" onClick={() => setSelected(null)}><X size={17} /></button></div>{entries.length ? <div className="memory-grid collection-memory-grid">{entries.map((memory) => <MemoryCard key={memory.id} memory={memory} onOpen={onOpen} />)}</div> : <p className="muted-copy">This shelf is empty. Add memories to it when you create or edit a memory.</p>}</section>}
  </div>;
}

type RecallTurn = { id: number; question: string; answer?: string; mode?: "live" | "demo" | "unknown"; sources?: MemoryRecord[]; error?: string; pending?: boolean };
const promptExamples = ["What did I learn about machine learning last month?", "Show me everything connected to neural networks.", "Where did I save that website about cybersecurity?", "How are my notes about AI connected?"];

export function RecallView({ onOpen, aiMode, memories }: { onOpen: (memory: MemoryRecord) => void; aiMode: "live" | "demo"; memories: MemoryRecord[] }) {
  const [question, setQuestion] = useState(""); const [conversationId, setConversationId] = useState<number | null>(null);
  const [optimistic, setOptimistic] = useState<RecallTurn | null>(null); const [pendingQuestion, setPendingQuestion] = useState("");
  const selectionEpoch = useRef(0);
  const utils = trpc.useUtils(); const mutation = trpc.memories.recall.useMutation();
  const conversationsQuery = trpc.conversations.list.useQuery();
  const messagesQuery = trpc.conversations.messages.useQuery({ conversationId: conversationId ?? 0 }, { enabled: conversationId !== null });
  const savedTurns = useMemo(() => {
    const turns: RecallTurn[] = []; let previousQuestion: { id: number; content: string } | null = null;
    for (const message of messagesQuery.data ?? []) {
      if (message.role === "question") previousQuestion = { id: message.id, content: message.content };
      else if (previousQuestion) {
        turns.push({ id: previousQuestion.id, question: previousQuestion.content, answer: message.content, mode: message.modelMode === "live" || message.modelMode === "demo" ? message.modelMode : "unknown", sources: memories.filter((memory) => message.citedMemoryIds.includes(memory.id)) });
        previousQuestion = null;
      }
    }
    return turns;
  }, [messagesQuery.data, memories]);
  const optimisticIsSaved = optimistic && savedTurns.some((turn) => turn.question === optimistic.question && turn.answer === optimistic.answer);
  const turns = optimistic && !optimisticIsSaved ? [...savedTurns, optimistic] : savedTurns;
  const ask = async (value: string) => {
    const clean = value.trim(); if (!clean || mutation.isPending) return;
    const requestEpoch = selectionEpoch.current;
    setQuestion(""); setPendingQuestion(clean); setOptimistic(null);
    try {
      const result = await mutation.mutateAsync({ question: clean, ...(conversationId === null ? {} : { conversationId }) });
      if (selectionEpoch.current !== requestEpoch) return;
      setConversationId(result.conversationId); setOptimistic({ id: Date.now(), question: clean, answer: result.answer, mode: result.mode, sources: result.sources });
      await utils.conversations.list.invalidate();
      await utils.conversations.messages.invalidate({ conversationId: result.conversationId });
      setPendingQuestion("");
    } catch (error) {
      if (selectionEpoch.current !== requestEpoch) return;
      setOptimistic({ id: Date.now(), question: clean, error: error instanceof Error ? error.message : "ECHO couldn't reach the archive. Please try again." });
      setQuestion(clean);
      setPendingQuestion("");
    }
  };
  const prompts = !turns.length && !pendingQuestion;
  return <div className="recall-view"><SectionTitle eyebrow="ASK YOUR OWN ARCHIVE" title="AI recall" detail="A conversation with what you've saved, not with the open web." action={<span className={`ai-mode ${aiMode}`}>{aiMode === "live" ? <><Sparkles size={12} /> LIVE AI</> : <><span className="demo-indicator" /> DEMO INTELLIGENCE</>}</span>} />
    <div className="conversation-history" aria-label="Saved conversations"><button className={`button button-quiet ${conversationId === null ? "active" : ""}`} onClick={() => { selectionEpoch.current += 1; setConversationId(null); setOptimistic(null); setPendingQuestion(""); }}>＋ New conversation</button>{(conversationsQuery.data ?? []).map((conversation) => <button key={conversation.id} className={`conversation-history-item ${conversationId === conversation.id ? "active" : ""}`} onClick={() => { selectionEpoch.current += 1; setConversationId(conversation.id); setOptimistic(null); setPendingQuestion(""); }}>{conversation.title}</button>)}</div>
    <div className="recall-stage"><div className="recall-conversation">
      {prompts && <div className="recall-welcome"><div className="recall-mark"><span /><i /></div><span className="eyebrow">YOUR MEMORY, IN CONVERSATION</span><h2>What are you trying to remember?</h2><p>ECHO searches your saved notes, links, and images, then shows its sources.</p><div className="prompt-suggestions">{promptExamples.map((prompt, index) => <button key={prompt} onClick={() => void ask(prompt)}><span>0{index + 1}</span>{prompt}<ArrowUpRight size={14} /></button>)}</div><div className="recall-privacy"><span className="privacy-dot" /> Answers use only your signed-in archive · source memories are always shown</div></div>}
      {messagesQuery.isError && <div className="answer-error" role="alert"><strong>Saved conversations are unavailable.</strong><p>{messagesQuery.error.message}</p></div>}
      {turns.map((turn) => <div key={turn.id} className="recall-turn"><div className="user-question"><span className="avatar-initial">Y</span><p>{turn.question}</p></div><div className="recall-answer"><span className="echo-mini-mark"><i /><b /></span><div className="answer-main">{turn.pending ? <div className="thinking"><span /><span /><span /> Looking through your memories…</div> : turn.error ? <div className="answer-error"><strong>That didn't work just now.</strong><p>{turn.error}</p><button className="text-action" onClick={() => void ask(turn.question)}>Try again <ArrowRight size={13} /></button></div> : <><div className="answer-label"><span>ECHO RECALL</span><span className={`ai-mode ${turn.mode === "live" || turn.mode === "demo" ? turn.mode : "demo"}`}>{turn.mode === "live" ? "LIVE AI" : turn.mode === "demo" ? "DEMO INTELLIGENCE" : "GENERATION MODE UNKNOWN"}</span></div><p className="answer-text">{turn.answer}</p>{turn.mode === "demo" && <p className="demo-answer-note">Demo intelligence · this answer is generated by local matching and saved summaries, not a live AI model.</p>}{turn.mode === "unknown" && <p className="demo-answer-note">This saved answer predates generation-mode tracking; its AI provenance is unknown.</p>}{turn.sources?.length ? <div className="answer-sources"><div className="sources-heading">CITED MEMORIES FROM YOUR ARCHIVE <span>{turn.sources.length}</span></div>{turn.sources.map((memory) => <button key={memory.id} className="source-memory-card" onClick={() => onOpen(memory)}><span className="source-memory-icon"><IconFor type={memory.sourceType} /></span><span><strong>{memory.title}</strong><small>{memory.category} · saved {savedDate(memory.createdAt)}</small></span><ArrowUpRight size={13} /></button>)}</div> : <p className="muted-copy">No saved memory was cited in this answer.</p>}</>}</div></div></div>)}
      {pendingQuestion && <div className="recall-turn"><div className="user-question"><span className="avatar-initial">Y</span><p>{pendingQuestion}</p></div><div className="thinking"><span /><span /><span /> Looking through your memories…</div></div>}
      {messagesQuery.isLoading && conversationId !== null && <div className="thinking"><span /><span /><span /> Loading saved conversation…</div>}
    </div><form className="recall-input" onSubmit={(event) => { event.preventDefault(); void ask(question); }}><div className="recall-input-icon"><MessageCircle size={16} /></div><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask something you saved…" aria-label="Ask ECHO about your saved memories" /><span className="recall-shortcut">↵</span><button className="send-button" disabled={!question.trim() || mutation.isPending} aria-label="Ask ECHO"><Send size={16} /></button></form><p className="recall-footnote"><Sparkles size={12} /> Your sources stay in this signed-in workspace. ECHO doesn't browse the web to answer.</p></div>
  </div>;
}

export function SettingsView({ memories, legacySamples, onPromoteLegacy, aiMode, user, onLogout, loggingOut }: { memories: MemoryRecord[]; legacySamples: LegacySampleRecord[]; onPromoteLegacy: (sample: LegacySampleRecord) => void; aiMode: "live" | "demo"; user: { name: string | null; email: string | null } | null; onLogout: () => void; loggingOut: boolean }) {
  const [exported, setExported] = useState(false);
  const exportArchive = () => {
    const payload = { exportedAt: new Date().toISOString(), format: "echo-memory-archive-v1", memories, collections: undefined };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `echo-archive-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); setExported(true); window.setTimeout(() => setExported(false), 2500);
  };
  return <div className="settings-view"><SectionTitle eyebrow="YOUR WORKSPACE, YOUR RULES" title="Settings" detail="A few details about this ECHO workspace." />
    <div className="settings-columns"><div className="settings-main">
      <section className="settings-panel"><div className="settings-panel-heading"><span className="settings-icon violet"><Command size={16} /></span><div><h2>Workspace</h2><p>Your private ECHO archive.</p></div></div><div className="settings-row"><span>Account</span><strong>{user?.name || user?.email || "Signed-in member"}</strong></div><div className="settings-row"><span>Saved memories</span><strong>{memories.length.toLocaleString()}</strong></div><div className="settings-row"><span>Data storage</span><strong className="status-inline"><span className="status-pip live-pip" /> Persistent database</strong></div><div className="settings-row"><span>Privacy</span><strong>Per-account workspace</strong></div><div className="settings-row settings-action-row"><div><strong>Export your archive</strong><small>Download a JSON copy of your memories and saved links.</small></div><button className="button button-quiet" onClick={exportArchive}><Upload size={14} />{exported ? "Downloaded" : "Export JSON"}</button></div><div className="settings-row settings-action-row"><div><strong>Sign out</strong><small>Your data stays saved to your account.</small></div><button className="button button-quiet" onClick={onLogout} disabled={loggingOut}>{loggingOut ? "Signing out…" : "Sign out"}</button></div></section>
      <section className="settings-panel"><div className="settings-panel-heading"><span className="settings-icon cyan"><FileText size={16} /></span><div><h2>Legacy sample memories</h2><p>Preserved separately from your personal archive. Promote only the records you want to keep in your workspace.</p></div></div>{legacySamples.length ? legacySamples.map((sample) => <div className="settings-row settings-action-row" key={sample.id}><div><strong>{sample.title}</strong><small>{sample.content.slice(0, 180)}{sample.content.length > 180 ? "…" : ""}</small></div><button className="button button-quiet" onClick={() => onPromoteLegacy(sample)}>Move to my archive</button></div>) : <p className="settings-explanation">No legacy sample memories need review.</p>}</section>
      <section className="settings-panel"><div className="settings-panel-heading"><span className={`settings-icon ${aiMode}`}><Sparkles size={16} /></span><div><h2>Intelligence</h2><p>Summaries, tags, connections, and recall.</p></div></div><div className="settings-row"><span>Current mode</span><strong className="status-inline"><span className={`status-pip ${aiMode === "live" ? "live-pip" : "demo-pip"}`} />{aiMode === "live" ? "Live AI available" : "Demo intelligence"}</strong></div><p className="settings-explanation">{aiMode === "live" ? "ECHO is connected to the server-side Manus AI service. Your API credentials are never exposed in the browser." : "The server is using deterministic, clearly labelled demo intelligence. Configure the platform AI service to enable live summaries and conversational recall."}</p><div className="settings-row"><span>Semantic search</span><strong>Not configured</strong></div><p className="settings-explanation final">Keyword, tag and category search are active. Semantic search will appear here once embeddings are configured.</p></section>
    </div><aside className="settings-side"><div className="settings-note"><span className="note-orbit"><i /><b /></span><span className="eyebrow">A SMALL REMINDER</span><h3>Your knowledge belongs to you.</h3><p>Memories and collections are kept in your signed-in workspace. Export a copy whenever you need it.</p></div><div className="settings-version"><span>ECHO</span><small>The Internet's Memory</small><em>Personal knowledge · built to reconnect</em></div></aside></div>
  </div>;
}


export function KnowledgeGapsView({ memories }: { memories: MemoryRecord[] }) {
  const coverage = useMemo(() => {
    const map = new Map<string, MemoryRecord[]>();
    memories.forEach((memory) => [...new Set([...memory.tags, ...memory.keyConcepts])].forEach((topic) => {
      const key = topic.trim();
      if (key) map.set(key, [...(map.get(key) ?? []), memory]);
    }));
    return [...map.entries()].map(([topic, items]) => ({ topic, items })).sort((a, b) => a.items.length - b.items.length || a.topic.localeCompare(b.topic));
  }, [memories]);
  const sparseTopics = coverage.filter((item) => item.items.length <= 2).slice(0, 8);
  const unconnected = memories.filter((memory) => memory.relatedIds.length === 0).slice(0, 4);

  return <div className="gaps-view">
    <SectionTitle eyebrow="EXPERIMENTAL · ARCHIVE-BASED" title="Knowledge gaps" detail="A gentle map of topics with lighter coverage in your saved archive—not a measure of what you know." action={<span className="graph-count-pill"><Sparkles size={13} /> Based on saved tags</span>} />
    {!memories.length ? <div className="empty-state"><div className="empty-orb"><Sparkles size={21} /></div><h2>Your archive needs a few threads first.</h2><p>Save and tag some memories. ECHO will then show which topics have lighter coverage in this archive.</p></div> : <div className="gaps-layout">
      <section className="surface gaps-panel"><div className="surface-heading"><div><span className="eyebrow">LIGHTER COVERAGE</span><h2>Topics to revisit</h2></div><span className="gap-count">{sparseTopics.length}</span></div>
        {sparseTopics.length ? <div className="gap-topic-list">{sparseTopics.map(({ topic, items }) => <article className="gap-topic" key={topic}><div><span className="gap-topic-label">{topic}</span><small>{items.length} saved {items.length === 1 ? "item" : "items"}</small></div><p>What else have you saved about {topic}?</p><span className="gap-source">{items[0]?.title}</span></article>)}</div> : <p className="muted-copy">No lightly covered tagged topics yet. Keep adding context to your archive.</p>}
      </section>
      <section className="surface gaps-panel"><div className="surface-heading"><div><span className="eyebrow">OPEN CONNECTIONS</span><h2>Items without links</h2></div><Network size={16} className="muted-icon" /></div>
        {unconnected.length ? <div className="gap-topic-list">{unconnected.map((memory) => <article className="gap-topic" key={memory.id}><div><span className="gap-topic-label">{memory.title}</span><small>{memory.category}</small></div><p>Which saved idea might this connect to?</p><span className="gap-source">{memory.tags.slice(0, 3).join(" · ") || "No topic tags yet"}</span></article>)}</div> : <p className="muted-copy">Every saved item currently has at least one connection.</p>}
      </section>
      <p className="gap-disclaimer">These prompts are derived from actual tags, item counts, and saved links. They describe coverage in this archive only; semantic topic discovery is unavailable until an embedding provider is configured.</p>
    </div>}
  </div>;
}

export function ProfileView({ user, onLogout, loggingOut }: {
  user: { name: string | null; email: string | null } | null;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  return <div className="profile-view"><SectionTitle eyebrow="YOUR ACCOUNT" title="Profile" detail="The account currently signed in to this private ECHO workspace." />
    <section className="settings-panel profile-panel"><div className="profile-avatar"><UserRound size={24} /></div><h2>{user?.name || "Signed-in member"}</h2><p>{user?.email || "Account details are not available."}</p><div className="settings-row"><span>Workspace access</span><strong>Private · account scoped</strong></div><div className="settings-row settings-action-row"><div><strong>Sign out of ECHO</strong><small>Your saved memories remain in your account.</small></div><button className="button button-quiet" onClick={onLogout} disabled={loggingOut}>{loggingOut ? "Signing out…" : "Sign out"}</button></div>
    </section>
  </div>;
}
