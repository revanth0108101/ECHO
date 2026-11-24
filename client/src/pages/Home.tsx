import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight, BookOpen, CalendarDays, ChevronDown, CircleHelp, Command, Ellipsis,
  FileText, FolderHeart, Lightbulb, LogOut, MessageCircle, Network, PanelLeftClose,
  PanelLeftOpen, Plus, Search, Settings2, Sparkles, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import MemoryDetailDialog from "@/components/MemoryDetailDialog";
import MemoryDialog from "@/components/MemoryDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import type { MemoryDraft, MemoryRecord } from "@/lib/echo";
import {
  CollectionsView, DashboardView, KnowledgeGapsView, KnowledgeGraphView, LibraryView, ProfileView,
  RecallView, SettingsView, TimelineView,
} from "./EchoViews";

const navItems = [
  { path: "/", label: "Overview", icon: Command },
  { path: "/memories", label: "My Memory", icon: BookOpen },
  { path: "/graph", label: "Knowledge Graph", icon: Network },
  { path: "/collections", label: "Collections", icon: FolderHeart },
  { path: "/assistant", label: "AI Assistant", icon: MessageCircle },
  { path: "/gaps", label: "Knowledge Gaps", icon: Lightbulb },
  { path: "/timeline", label: "Timeline", icon: CalendarDays },
];
const utilityItems = [
  { path: "/settings", label: "Settings", icon: Settings2 },
  { path: "/profile", label: "Profile", icon: UserRound },
];
const pageByPath = new Map([...navItems, ...utilityItems, { path: "/recall", label: "AI Assistant" }].map((item) => [item.path, item.label]));
const mobilePrimary = navItems.filter((item) => ["/", "/memories", "/graph", "/assistant"].includes(item.path));
const mobileMore = navItems.filter((item) => !mobilePrimary.some((primary) => primary.path === item.path)).concat(utilityItems);

function LogoMark({ large = false }: { large?: boolean }) {
  return <span className={`echo-mark ${large ? "echo-mark-large" : ""}`} aria-hidden="true"><i /><b /><em /></span>;
}

function Brand() {
  return <div className="brand-lockup"><LogoMark /><span className="brand-word">ECHO<span>.</span><small>THE INTERNET'S MEMORY</small></span></div>;
}

function LoadingScreen() {
  return <div className="app-loading"><LogoMark large /><span className="loading-line" /><p>Opening your memory space…</p></div>;
}

function SignInScreen({ onSignIn, error, onRetry }: { onSignIn: () => void; error?: string | null; onRetry: () => void }) {
  const [loginError, setLoginError] = useState("");
  return <main className="signin-page"><div className="signin-grid" /><div className="signin-orbit orbit-one" /><div className="signin-orbit orbit-two" />
    <section className="signin-panel"><Brand /><span className="eyebrow signin-eyebrow">A HOME FOR THE THINGS THAT STAY WITH YOU</span><h1>Your ideas<br /><em>have a way back.</em></h1><p>Keep the links, notes, and sparks you want to find again. ECHO gives every memory a place, and every connection a path.</p>
      <div className="signin-points"><div><span className="signin-point-icon violet"><BookmarkIcon /></span><span><strong>Keep your context</strong><small>Notes and sources, saved together.</small></span></div><div><span className="signin-point-icon cyan"><Network size={15} /></span><span><strong>Follow the connections</strong><small>Let your archive show its shape.</small></span></div><div><span className="signin-point-icon blue"><Sparkles size={15} /></span><span><strong>Recall with provenance</strong><small>Answers point back to what you saved.</small></span></div></div>
      <button className="button button-primary signin-button" onClick={() => { try { setLoginError(""); onSignIn(); } catch (cause) { setLoginError(cause instanceof Error ? cause.message : "Sign-in is not available right now."); } }}>Continue with Manus <ArrowRight size={16} /></button>
      {(loginError || error) && <div className="signin-error" role="alert">{loginError || error}<button onClick={onRetry}>Try again</button></div>}
      <div className="signin-security"><span className="privacy-dot" />Sign in to access your private, account-scoped memory archive.</div>
    </section><div className="signin-footer">A quieter way to keep what matters.</div>
  </main>;
}
function BookmarkIcon() { return <FileText size={15} />; }

export default function Home() {
  const auth = useAuth();
  const [location, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editing, setEditing] = useState<MemoryRecord | null>(null);
  const [selected, setSelected] = useState<MemoryRecord | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const memoriesQuery = trpc.memories.list.useQuery(undefined, { enabled: auth.isAuthenticated, retry: 1, staleTime: 10_000 });
  const collectionsQuery = trpc.collections.list.useQuery(undefined, { enabled: auth.isAuthenticated, retry: 1, staleTime: 10_000 });
  const aiStatusQuery = trpc.app.aiStatus.useQuery(undefined, { retry: 1, staleTime: 30_000 });
  const createMutation = trpc.memories.create.useMutation();
  const updateMutation = trpc.memories.update.useMutation();
  const removeMutation = trpc.memories.remove.useMutation();
  const enrichMutation = trpc.memories.enrich.useMutation();
  const createCollectionMutation = trpc.collections.create.useMutation();
  const removeCollectionMutation = trpc.collections.remove.useMutation();
  const memories = memoriesQuery.data ?? [];
  const collections = collectionsQuery.data ?? [];
  const aiMode = aiStatusQuery.data?.mode ?? "demo";
  const currentPath = location === "/recall" ? "/assistant" : pageByPath.has(location) ? location : "/";
  const activePage = pageByPath.get(currentPath) ?? "Overview";
  const selectedMemory = selected ? memories.find((memory) => memory.id === selected.id) ?? selected : null;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setMobileMoreOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openCapture = () => { setSelected(null); setEditing(null); setCaptureOpen(true); setMobileMoreOpen(false); };
  const refreshWorkspace = async () => {
    await Promise.all([utils.memories.list.invalidate(), utils.collections.list.invalidate()]);
  };
  const openMemory = (memory: MemoryRecord) => { setCaptureOpen(false); setEditing(null); setSelected(memory); };
  const openEdit = (memory: MemoryRecord) => { setSelected(null); setEditing(memory); };
  const saveMemory = async (draft: MemoryDraft) => {
    const base = {
      title: draft.title, content: draft.content, source: draft.source || null, sourceUrl: draft.sourceUrl || null,
      sourceType: draft.sourceType, category: draft.category, tags: draft.tags,
      attachmentData: draft.attachmentData, attachmentName: draft.attachmentName,
      createdAt: draft.createdAt, relatedIds: draft.relatedIds, collectionIds: draft.collectionIds,
    };
    if (editing) {
      const { createdAt: _preservedDate, ...updateData } = base;
      await updateMutation.mutateAsync({ id: editing.id, data: updateData });
    } else await createMutation.mutateAsync(base);
    setCaptureOpen(false); setEditing(null); setSelected(null);
    await refreshWorkspace();
    toast.success(editing ? "Memory updated" : "Memory saved", { description: "It is now part of your archive." });
  };
  const deleteMemory = async (memory: MemoryRecord) => {
    if (!window.confirm(`Delete “${memory.title}” from your archive? This cannot be undone.`)) return;
    try {
      await removeMutation.mutateAsync({ id: memory.id });
      setSelected(null); await refreshWorkspace(); toast.success("Memory deleted");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Memory could not be deleted."); }
  };
  const enrichMemory = async (id: number) => {
    setAnalyzingId(id);
    try {
      const result = await enrichMutation.mutateAsync({ id });
      await refreshWorkspace();
      toast.success(result.mode === "live" ? "Memory enriched with live AI" : "Demo intelligence added", {
        description: result.mode === "live" ? "Summary, concepts and relationships are saved." : "Local heuristics updated your memory. This was not a live AI response.",
      });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Memory could not be analyzed."); }
    finally { setAnalyzingId(null); }
  };
  const saveCollection = async (name: string, description: string, color: string) => {
    await createCollectionMutation.mutateAsync({ name, description, color: color as "violet" | "cyan" | "blue" | "rose" | "amber" });
    await utils.collections.list.invalidate(); toast.success("Collection created");
  };
  const deleteCollection = async (collection: (typeof collections)[number]) => {
    try { await removeCollectionMutation.mutateAsync({ id: collection.id }); await refreshWorkspace(); toast.success("Collection deleted", { description: "Its memories remain in your archive." }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Collection could not be deleted."); }
  };
  const startSignIn = () => startLogin();

  if (auth.loading) return <LoadingScreen />;
  if (!auth.isAuthenticated) return <SignInScreen onSignIn={startSignIn} error={auth.error ? "Sign-in could not be verified. Please try again." : null} onRetry={() => void auth.refresh()} />;
  if (memoriesQuery.isLoading || collectionsQuery.isLoading) return <LoadingScreen />;
  if (memoriesQuery.isError) return <main className="app-error"><Brand /><span className="error-orbit"><CircleHelp size={21} /></span><h1>Your archive couldn't load.</h1><p>We couldn't reach the ECHO memory database. Your saved memories haven't been removed.</p><button className="button button-primary" onClick={() => void memoriesQuery.refetch()}>Try again <ArrowRight size={15} /></button><button className="text-action" onClick={() => void auth.logout()}>Sign out</button></main>;
  if (collectionsQuery.isError) return <main className="app-error"><Brand /><span className="error-orbit"><CircleHelp size={21} /></span><h1>Your collections couldn't load.</h1><p>Your memories are safe. Retry to reload the workspace's collections and membership data.</p><button className="button button-primary" onClick={() => void collectionsQuery.refetch()}>Try again <ArrowRight size={15} /></button><button className="text-action" onClick={() => void auth.logout()}>Sign out</button></main>;

  const globalSearch = (event: FormEvent) => { event.preventDefault(); if (query.trim()) navigate("/memories"); };
  return <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
    <aside className="app-sidebar">
      <div className="sidebar-brand-row"><Link href="/" className="sidebar-brand" aria-label="ECHO overview"><Brand /></Link><button className="sidebar-collapse icon-button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed((value) => !value)} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button></div>
      <div className="sidebar-section-label">YOUR SPACE</div>
      <nav className="main-nav" aria-label="Main navigation">{navItems.map((item) => {
        const Icon = item.icon; const active = currentPath === item.path;
        return <Link key={item.path} href={item.path} className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} title={sidebarCollapsed ? item.label : undefined}><Icon size={17} strokeWidth={active ? 2 : 1.8} /><span>{item.label}</span>{active && <i />}</Link>;
      })}</nav>
      <div className="sidebar-lower">
        <button className="sidebar-capture" onClick={openCapture}><span><Plus size={15} /></span><b>Quick capture</b></button>
        <nav className="utility-nav" aria-label="Account navigation">{utilityItems.map((item) => { const Icon = item.icon; const active = currentPath === item.path; return <Link key={item.path} href={item.path} className={`nav-item utility-nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} title={sidebarCollapsed ? item.label : undefined}><Icon size={16} /><span>{item.label}</span>{active && <i />}</Link>; })}</nav>
        <ThemeToggle />
        <div className="sidebar-account"><span className="account-avatar">{(auth.user?.name || auth.user?.email || "E").slice(0, 1).toUpperCase()}</span><span className="account-label"><strong>{auth.user?.name || "Your ECHO space"}</strong><small>{auth.user?.email || "Private workspace"}</small></span><button title="Sign out" aria-label="Sign out" className="icon-button account-logout" onClick={() => void auth.logout()}><LogOut size={15} /></button></div>
      </div>
    </aside>
    <main className="workspace-main">
      <header className="topbar"><div className="topbar-title"><span className="topbar-mobile-brand"><Brand /></span><span className="breadcrumb-root">Workspace</span><span className="breadcrumb-slash">/</span><strong>{activePage}</strong><ChevronDown size={13} className="breadcrumb-chevron" /></div>
        <div className="topbar-actions"><form className="global-search" role="search" onSubmit={globalSearch}><Search size={15} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your memory" aria-label="Search memories" /><kbd>⌘ K</kbd></form><button className="topbar-capture" aria-label="Capture a memory" title="Capture a memory" onClick={openCapture}><Plus size={17} /></button><Link className="topbar-avatar" aria-label="Open profile" title={auth.user?.name ?? "Profile"} href="/profile">{(auth.user?.name || auth.user?.email || "E").slice(0, 1).toUpperCase()}</Link></div>
      </header>
      <section className="page-content" key={currentPath}>
        {currentPath === "/" && <DashboardView memories={memories} collections={collections} onOpen={openMemory} onCapture={openCapture} onNavigate={navigate} onSearch={setQuery} />}
        {currentPath === "/memories" && <LibraryView memories={memories} onOpen={openMemory} onCapture={openCapture} query={query} setQuery={setQuery} />}
        {currentPath === "/graph" && <KnowledgeGraphView memories={memories} onOpen={openMemory} />}
        {currentPath === "/assistant" && <RecallView onOpen={openMemory} aiMode={aiMode} memories={memories} />}
        {currentPath === "/timeline" && <TimelineView memories={memories} onOpen={openMemory} />}
        {currentPath === "/collections" && <CollectionsView collections={collections} memories={memories} onOpen={openMemory} onCreate={saveCollection} onDelete={deleteCollection} />}
        {currentPath === "/settings" && <SettingsView memories={memories} aiMode={aiMode} user={auth.user} onLogout={() => void auth.logout()} loggingOut={auth.loading} />}
        {currentPath === "/profile" && <ProfileView user={auth.user} onLogout={() => void auth.logout()} loggingOut={auth.loading} />}
        {currentPath === "/gaps" && <KnowledgeGapsView memories={memories} />}
      </section>
      <footer className="workspace-footer"><span><span className="footer-pulse" />Your archive is in sync</span><span><LogoMark /> A little more connected.</span></footer>
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {mobilePrimary.map((item) => { const Icon = item.icon; const active = currentPath === item.path; return <Link key={item.path} href={item.path} className={`mobile-nav-item ${active ? "active" : ""}`} aria-label={item.label} aria-current={active ? "page" : undefined}><Icon size={18} /><span>{item.label}</span></Link>; })}
      <button className={`mobile-nav-item ${mobileMoreOpen ? "active" : ""}`} aria-label="More destinations" aria-expanded={mobileMoreOpen} onClick={() => setMobileMoreOpen((value) => !value)}><Ellipsis size={20} /><span>More</span></button>
    </nav>
    {mobileMoreOpen && <div className="mobile-more-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMoreOpen(false); }}><section className="mobile-more-sheet" aria-label="More destinations"><header><strong>More in ECHO</strong><button className="icon-button" aria-label="Close menu" onClick={() => setMobileMoreOpen(false)}>×</button></header>{mobileMore.map((item) => { const Icon = item.icon; return <Link key={item.path} href={item.path} className="mobile-more-item" onClick={() => setMobileMoreOpen(false)}><Icon size={17} /><span>{item.label}</span><ArrowRight size={14} /></Link>; })}<div className="mobile-more-theme"><span>Appearance</span><ThemeToggle /></div></section></div>}
    {(captureOpen || editing) && <MemoryDialog initial={editing} memories={memories} collections={collections} onClose={() => { setCaptureOpen(false); setEditing(null); }} onSave={saveMemory} />}
    {selectedMemory && <MemoryDetailDialog memory={selectedMemory} memories={memories} mode={aiMode} analyzing={analyzingId === selectedMemory.id} onClose={() => setSelected(null)} onEdit={openEdit} onDelete={(memory) => void deleteMemory(memory)} onEnrich={(id) => void enrichMemory(id)} onOpenRelated={openMemory} />}
  </div>;
}
