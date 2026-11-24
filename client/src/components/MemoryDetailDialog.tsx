import { ArrowUpRight, CalendarDays, Pencil, Sparkles, Tags, Trash2, X } from "lucide-react";
import type { MemoryRecord } from "@/lib/echo";

type Props = {
  memory: MemoryRecord;
  memories: MemoryRecord[];
  mode: "live" | "demo";
  analyzing: boolean;
  onClose: () => void;
  onEdit: (memory: MemoryRecord) => void;
  onDelete: (memory: MemoryRecord) => void;
  onEnrich: (id: number) => void;
  onOpenRelated: (memory: MemoryRecord) => void;
};

export default function MemoryDetailDialog({ memory, memories, mode, analyzing, onClose, onEdit, onDelete, onEnrich, onOpenRelated }: Props) {
  const related = memories.filter((item) => memory.relatedIds.includes(item.id));
  const formatted = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(memory.createdAt);
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="memory-detail-title">
        <header className="detail-topline"><span className="category-pill">{memory.category}</span><button type="button" className="icon-button" aria-label="Close memory" onClick={onClose}><X size={18} /></button></header>
        <h2 id="memory-detail-title" className="detail-title">{memory.title}</h2>
        <div className="detail-meta"><span><CalendarDays size={14} /> {formatted}</span>{memory.source && <span className="detail-source">{memory.source}</span>}{memory.sourceUrl && <a href={memory.sourceUrl} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={13} /></a>}</div>
        {memory.attachmentData && <img className="detail-image" src={memory.attachmentData} alt={memory.attachmentName ?? memory.title} />}
        {memory.content && <p className="detail-content">{memory.content}</p>}
        {memory.tags.length > 0 && <div className="detail-tags"><Tags size={14} />{memory.tags.map((tag) => <span key={tag} className="tag-pill">{tag}</span>)}</div>}
        <section className="insight-box">
          <div className="insight-head"><div><Sparkles size={15} /><strong>{memory.summary ? "Memory brief" : "Make this memory useful"}</strong></div><span className={`ai-mode ${mode}`}>{mode === "live" ? "LIVE AI AVAILABLE" : "DEMO MODE"}</span></div>
          {memory.summary ? <p>{memory.summary}</p> : <p>Get a concise summary, useful tags, concepts, and suggestions for related memories.</p>}
          {memory.keyConcepts.length > 0 && <div className="concept-row">{memory.keyConcepts.map((concept) => <span key={concept}>{concept}</span>)}</div>}
          <button type="button" className="text-action" disabled={analyzing} onClick={() => onEnrich(memory.id)}>{analyzing ? <><span className="spinner" /> Analyzing…</> : <><Sparkles size={14} /> {memory.summary ? "Refresh intelligence" : "Analyze memory"}</>}</button>
          <small className="demo-note">{mode === "demo" ? "Demo mode uses local heuristics; it is not a live AI response." : "Live AI is available for new analyses. This saved brief may have been created in an earlier mode."}</small>
        </section>
        <section className="related-section"><div className="section-heading-small"><span>Connected memories</span><span>{related.length} {related.length === 1 ? "link" : "links"}</span></div>{related.length ? <div className="related-list">{related.map((item) => <button type="button" key={item.id} onClick={() => onOpenRelated(item)}><span className="related-dot" /><span><strong>{item.title}</strong><small>{item.category}</small></span><ArrowUpRight size={14} /></button>)}</div> : <p className="muted-copy">No saved connections yet. Connect it to another memory or run an analysis.</p>}</section>
        <footer className="detail-footer"><button type="button" className="button button-danger-quiet" onClick={() => onDelete(memory)}><Trash2 size={15} /> Delete</button><button type="button" className="button button-primary" onClick={() => onEdit(memory)}><Pencil size={15} /> Edit memory</button></footer>
      </section>
    </div>
  );
}
