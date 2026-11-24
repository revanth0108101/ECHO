import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ImagePlus, Link2, NotebookPen, Sparkles, X } from "lucide-react";
import type { CollectionRecord, MemoryDraft, MemoryRecord } from "@/lib/echo";
import { CATEGORY_OPTIONS } from "@/lib/echo";

type Props = {
  initial?: MemoryRecord | null;
  memories: MemoryRecord[];
  collections: CollectionRecord[];
  onClose: () => void;
  onSave: (draft: MemoryDraft) => Promise<void>;
};

const localDate = (date?: Date) => {
  const value = date ?? new Date();
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export default function MemoryDialog({ initial, memories, collections, onClose, onSave }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [sourceType, setSourceType] = useState<MemoryDraft["sourceType"]>(initial?.sourceType ?? "note");
  const [category, setCategory] = useState(initial?.category ?? "Ideas & notes");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [date, setDate] = useState(localDate(initial?.createdAt));
  const [attachmentData, setAttachmentData] = useState<string | null>(initial?.attachmentData ?? null);
  const [attachmentName, setAttachmentName] = useState<string | null>(initial?.attachmentName ?? null);
  const [relatedIds, setRelatedIds] = useState<number[]>(initial?.relatedIds ?? []);
  const [collectionIds, setCollectionIds] = useState<number[]>(initial?.collectionIds ?? []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const availableRelated = useMemo(() => memories.filter((memory) => memory.id !== initial?.id), [memories, initial?.id]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggle = (list: number[], setList: (next: number[]) => void, id: number) => {
    setList(list.includes(id) ? list.filter((value) => value !== id) : [...list, id]);
  };

  const loadImage = (file?: File) => {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image or screenshot file."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("For this workspace, images must be 8 MB or smaller."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAttachmentData(reader.result);
        setAttachmentName(file.name.slice(0, 240));
        if (sourceType === "note" || sourceType === "text") setSourceType("image");
      } else setError("The selected image could not be read. Try another file.");
    };
    reader.onerror = () => setError("The selected image could not be read. Try another file.");
    reader.readAsDataURL(file);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!title.trim()) { setError("A short title is required."); return; }
    if (!content.trim() && !attachmentData) { setError("Add some text or attach an image before saving."); return; }
    if (sourceUrl.trim()) {
      try { const url = new URL(sourceUrl); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); }
      catch { setError("Enter a valid http or https source link."); return; }
    }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(), content: content.trim(), source: source.trim(), sourceUrl: sourceUrl.trim(), sourceType, category,
        tags: [...new Set(tags.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 16),
        attachmentData, attachmentName, createdAt: new Date(`${date}T12:00:00`).toISOString(), relatedIds, collectionIds,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The memory could not be saved. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="memory-dialog" role="dialog" aria-modal="true" aria-labelledby="memory-dialog-title">
        <header className="dialog-header">
          <div className="dialog-title-icon"><NotebookPen size={17} /></div>
          <div><span className="eyebrow">{initial ? "REFINE YOUR ARCHIVE" : "ADD TO YOUR MEMORY"}</span><h2 id="memory-dialog-title">{initial ? "Edit memory" : "Capture a thought"}</h2></div>
          <button type="button" className="icon-button dialog-close" aria-label="Close capture" onClick={onClose}><X size={18} /></button>
        </header>
        <form onSubmit={submit} className="capture-form">
          <label className="field-label">Title <span className="required-dot">*</span>
            <input autoFocus maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Give this memory a useful name" />
          </label>
          <div className="form-two-col">
            <label className="field-label">Memory type
              <select value={sourceType} onChange={(event) => setSourceType(event.target.value as MemoryDraft["sourceType"])}>
                <option value="note">Personal note</option><option value="text">Text clipping</option><option value="url">Website</option><option value="image">Image</option><option value="screenshot">Screenshot</option>
              </select>
            </label>
            <label className="field-label">Category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {!CATEGORY_OPTIONS.includes(category) && <option>{category}</option>}
                {CATEGORY_OPTIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <label className="field-label">Content
            <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Save the idea, excerpt, or context you want to remember…" rows={6} maxLength={30000} />
            <span className="field-hint">{content.length.toLocaleString()} / 30,000 characters</span>
          </label>
          <div className="form-two-col">
            <label className="field-label">Source label
              <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="e.g. Personal journal or arXiv" maxLength={1000} />
            </label>
            <label className="field-label">Saved date {initial && <span className="field-hint inline-hint">original date is preserved</span>}
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required disabled={Boolean(initial)} />
            </label>
          </div>
          <label className="field-label">Source URL <span className="field-hint inline-hint">optional</span>
            <div className="input-with-icon"><Link2 size={15} /><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" maxLength={2048} /></div>
          </label>
          <label className="field-label">Tags <span className="field-hint inline-hint">comma separated</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="research, systems thinking, design" />
          </label>
          <div className="field-label">Image or screenshot <span className="field-hint inline-hint">up to 8 MB</span>
            <label className="image-dropzone">
              {attachmentData ? <img src={attachmentData} alt={attachmentName ?? "Attached memory"} /> : <span className="image-drop-icon"><ImagePlus size={20} /></span>}
              <span className="image-drop-copy"><strong>{attachmentData ? attachmentName : "Attach an image or screenshot"}</strong><small>{attachmentData ? "Choose another file to replace it" : "JPG, PNG, WebP, GIF · stored with this memory"}</small></span>
              <input aria-label="Choose image or screenshot" type="file" accept="image/*" onChange={(event) => loadImage(event.target.files?.[0])} />
              {attachmentData && <button type="button" className="image-remove" aria-label="Remove attached image" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setAttachmentData(null); setAttachmentName(null); }}><X size={14} /></button>}
            </label>
          </div>
          {availableRelated.length > 0 && <fieldset className="choice-fieldset"><legend>Connect related memories</legend><div className="choice-list">{availableRelated.slice(0, 8).map((memory) => <label key={memory.id} className="choice-row"><input type="checkbox" checked={relatedIds.includes(memory.id)} onChange={() => toggle(relatedIds, setRelatedIds, memory.id)} /><span>{memory.title}</span></label>)}</div></fieldset>}
          {collections.length > 0 && <fieldset className="choice-fieldset"><legend>Add to collections</legend><div className="choice-list compact">{collections.map((collection) => <label key={collection.id} className="choice-row"><input type="checkbox" checked={collectionIds.includes(collection.id)} onChange={() => toggle(collectionIds, setCollectionIds, collection.id)} /><span>{collection.name}</span></label>)}</div></fieldset>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <footer className="dialog-footer">
            <span className="form-private"><Sparkles size={13} /> AI enrichment stays optional</span>
            <div className="button-row"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? <><span className="spinner" /> Saving…</> : initial ? "Save changes" : "Save memory"}</button></div>
          </footer>
        </form>
      </section>
    </div>
  );
}
