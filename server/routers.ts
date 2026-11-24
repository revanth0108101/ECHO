import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createCollection,
  createMemory,
  deleteCollection,
  deleteMemory,
  getCollections,
  getMemories,
  seedSampleDataOnce,
  updateMemory,
  type MemoryWithLinks,
} from "./echo-db";

const sourceType = z.enum(["note", "text", "url", "image", "screenshot"]);
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(16).default([]);
const stringIds = z.array(z.number().int().positive()).max(100);
const safeSourceUrl = z.string().url().max(2048).refine((value) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}, "Source links must use http or https.");
const memoryShape = z.object({
  title: z.string().trim().min(1).max(240),
  content: z.string().max(30000).default(""),
  source: z.string().max(1000).optional().nullable(),
  sourceUrl: safeSourceUrl.optional().nullable().or(z.literal("")),
  sourceType,
  category: z.string().trim().min(1).max(80).default("Unsorted"),
  tags: tagsSchema,
  attachmentData: z.string().max(12_000_000).optional().nullable(),
  attachmentName: z.string().max(240).optional().nullable(),
  createdAt: z.string().datetime().optional(),
  relatedIds: stringIds.default([]),
  collectionIds: stringIds.default([]),
});
const memoryCreate = memoryShape.refine((value) => value.content.trim().length > 0 || Boolean(value.attachmentData), {
  message: "Add some text or attach an image before saving.", path: ["content"],
});

function normalizeContent(text: string) {
  return text.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}
const STOP_WORDS = new Set("the and for are was were with from this that into about your have has had not but all their then than them they what when where which while also can could should would will into out use using used its our you how why save saved idea ideas notes note memory memories from over under between because based after before onto than into does did".split(" "));

function topConcepts(content: string, tags: string[], limit = 5) {
  const counts = new Map<string, number>();
  for (const word of normalizeContent(content)) counts.set(word, (counts.get(word) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([word]) => word);
  return [...new Set([...tags.slice(0, 2), ...ranked])].slice(0, limit);
}

function classify(content: string, existing = "") {
  const text = `${content} ${existing}`.toLowerCase();
  if (/machine learning|neural|transformer|model|artificial intelligence|\bai\b|embedding/.test(text)) return "Artificial intelligence";
  if (/security|cyber|zero trust|privacy|threat|encryption/.test(text)) return "Security";
  if (/design|interface|visual|typography|user experience|\bux\b/.test(text)) return "Design";
  if (/knowledge|second brain|note-taking|workflow/.test(text)) return "Knowledge systems";
  if (/product|startup|customer|roadmap/.test(text)) return "Product thinking";
  return existing || "Ideas & notes";
}

function demoEnrichment(memory: MemoryWithLinks, all: MemoryWithLinks[]) {
  const summary = memory.summary?.trim() || memory.content.trim().split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 260) || `A saved ${memory.sourceType} about ${memory.title}.`;
  const concepts = memory.keyConcepts.length ? memory.keyConcepts : topConcepts(`${memory.title} ${memory.content}`, memory.tags);
  const tags = [...new Set([...memory.tags, ...topConcepts(`${memory.title} ${memory.content}`, [], 5)])].slice(0, 6);
  const category = classify(`${memory.title} ${memory.content}`, memory.category);
  const ownTokens = new Set([...normalizeContent(`${memory.title} ${memory.content}`), ...memory.tags.map((tag) => tag.toLowerCase())]);
  const relatedIds = all.filter((item) => item.id !== memory.id).map((item) => {
    const otherTokens = new Set([...normalizeContent(`${item.title} ${item.content}`), ...item.tags.map((tag) => tag.toLowerCase())]);
    const overlap = [...ownTokens].filter((token) => otherTokens.has(token)).length;
    return { id: item.id, score: overlap + (item.category === category ? 0.2 : 0) };
  }).filter((item) => item.score >= 1).sort((a, b) => b.score - a.score).slice(0, 4).map((item) => item.id);
  return { summary, concepts, tags, category, relatedIds };
}

async function callLiveAI(messages: Array<{ role: "system" | "user"; content: string }>) {
  const apiUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!apiUrl || !apiKey) return null;
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => null) as { error?: { message?: string }; choices?: Array<{ message?: { content?: unknown } }> } | null;
  if (!response.ok || payload?.error) throw new Error(payload?.error?.message || `AI service returned ${response.status}`);
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

function parseJsonResponse(text: string) {
  const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = unfenced.indexOf("{"); const end = unfenced.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced) as Record<string, unknown>;
}

function rankRelevant(question: string, all: MemoryWithLinks[]) {
  const tokens = new Set(normalizeContent(question));
  const lower = question.toLowerCase();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const asksLastMonth = /last month|previous month/.test(lower);
  return all.map((memory) => {
    const title = memory.title.toLowerCase(); const content = `${memory.content} ${memory.summary ?? ""}`.toLowerCase();
    const terms = [...tokens].reduce((score, token) => score + (title.includes(token) ? 4 : 0) + (content.includes(token) ? 1 : 0) + (memory.tags.some((tag) => tag.toLowerCase().includes(token)) ? 3 : 0), 0);
    const asksNamedMonth = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
      .some((month, index) => lower.includes(month) && memory.createdAt.getMonth() === index);
    const dateIntent = asksLastMonth
      ? (memory.createdAt.getMonth() === lastMonth.getMonth() && memory.createdAt.getFullYear() === lastMonth.getFullYear() ? 2 : 0)
      : (asksNamedMonth ? 2 : 0);
    const linkIntent = /connected|related|connection/.test(lower) && memory.relatedIds.length ? 1.5 : 0;
    return { memory, score: terms + dateIntent + linkIntent };
  }).sort((a, b) => b.score - a.score || b.memory.createdAt.getTime() - a.memory.createdAt.getTime());
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  app: router({
    aiStatus: publicProcedure.query(() => ({ mode: ENV.forgeApiUrl && ENV.forgeApiKey ? "live" as const : "demo" as const })),
  }),
  memories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await seedSampleDataOnce(ctx.user.id);
      return getMemories(ctx.user.id);
    }),
    create: protectedProcedure.input(memoryCreate).mutation(async ({ ctx, input }) => {
      if (!input.content.trim() && !input.attachmentData) throw new TRPCError({ code: "BAD_REQUEST", message: "Add text or an image before saving." });
      const { createdAt, ...data } = input;
      const id = await createMemory(ctx.user.id, { ...data, sourceUrl: data.sourceUrl || null, createdAt: createdAt ? new Date(createdAt) : undefined, keyConcepts: [] });
      return { id };
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: memoryShape.omit({ createdAt: true }).partial() })).mutation(async ({ ctx, input }) => {
      const data = input.data;
      await updateMemory(ctx.user.id, input.id, { ...data, sourceUrl: data.sourceUrl === "" ? null : data.sourceUrl });
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await deleteMemory(ctx.user.id, input.id);
      return { success: true };
    }),
    enrich: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await seedSampleDataOnce(ctx.user.id);
      const all = await getMemories(ctx.user.id);
      const memory = all.find((item) => item.id === input.id);
      if (!memory) throw new TRPCError({ code: "NOT_FOUND", message: "Memory not found." });
      let result: ReturnType<typeof demoEnrichment>;
      let mode: "live" | "demo" = "demo";
      try {
        const existing = all.filter((item) => item.id !== memory.id).map(({ id, title, category, tags, summary }) => ({ id, title, category, tags, summary }));
        const completion = await callLiveAI([
          { role: "system", content: "You enrich personal knowledge memories. Use only the provided memory and candidate records. Return one valid JSON object with keys summary (string), concepts (string array), tags (string array), category (string), relatedIds (integer array). Choose relatedIds only from the candidate ids; empty is valid. Be concise and do not invent facts or relationships." },
          { role: "user", content: JSON.stringify({ memory: { id: memory.id, title: memory.title, content: memory.content, tags: memory.tags, category: memory.category }, candidates: existing.slice(0, 50) }) },
        ]);
        if (!completion) throw new Error("The AI service returned no completion text.");
        const parsed = parseJsonResponse(completion);
        const allowedIds = new Set(existing.map((item) => item.id));
        result = {
          summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 1000) : "",
          concepts: Array.isArray(parsed.concepts) ? parsed.concepts.filter((value): value is string => typeof value === "string").slice(0, 10) : [],
          tags: Array.isArray(parsed.tags) ? parsed.tags.filter((value): value is string => typeof value === "string").slice(0, 12) : [],
          category: typeof parsed.category === "string" && parsed.category.trim() ? parsed.category.slice(0, 80) : memory.category,
          relatedIds: Array.isArray(parsed.relatedIds) ? parsed.relatedIds.filter((value): value is number => Number.isInteger(value) && allowedIds.has(value)).slice(0, 8) : [],
        };
        if (!result.summary) throw new Error("The AI response did not contain a usable summary.");
        mode = "live";
      } catch (error) {
        console.warn("[ECHO AI] Enrichment used demo mode:", error instanceof Error ? error.message : "request failed");
        result = demoEnrichment(memory, all);
      }
      await updateMemory(ctx.user.id, memory.id, { summary: result.summary, keyConcepts: result.concepts, tags: result.tags, category: result.category, relatedIds: result.relatedIds });
      return { ...result, mode };
    }),
    recall: protectedProcedure.input(z.object({ question: z.string().trim().min(1).max(2000) })).mutation(async ({ ctx, input }) => {
      await seedSampleDataOnce(ctx.user.id);
      const all = await getMemories(ctx.user.id);
      const ranked = rankRelevant(input.question, all);
      const selected = ranked.filter((item) => item.score > 0).slice(0, 6).map((item) => item.memory);
      if (!all.length) return { answer: "Your archive is empty, so I don't have saved memories to answer from yet. Capture a note or a link and ask me again.", mode: "demo" as const, sources: [] };
      if (!selected.length) return { answer: "I couldn't find a saved memory relevant to that question. Try another topic, phrase, or source name.", mode: "demo" as const, sources: [] };
      const sources = selected;
      let answer: string | null = null;
      let mode: "live" | "demo" = "demo";
      try {
        const completion = await callLiveAI([
          { role: "system", content: "You are ECHO Recall. Answer the user's question using only the saved memory excerpts in the supplied context. If the context does not answer it, clearly say so. Never introduce outside facts or pretend to remember a source that is absent. Refer to sources by their exact [id] as needed; the app will show source cards." },
          { role: "user", content: JSON.stringify({ question: input.question, savedMemories: sources.map(({ id, title, content, summary, category, tags, createdAt }) => ({ id, title, content: content.slice(0, 4000), summary, category, tags, createdAt: createdAt.toISOString() })) }) },
        ]);
        if (completion) { answer = completion; mode = "live"; }
      } catch (error) {
        console.warn("[ECHO AI] Recall used demo mode:", error instanceof Error ? error.message : "request failed");
      }
      if (!answer) {
        const questionTerms = normalizeContent(input.question);
        const best = sources.filter((memory) => questionTerms.some((term) => `${memory.title} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase().includes(term)));
        answer = best.length
          ? `I found ${best.length} saved ${best.length === 1 ? "memory" : "memories"} that match your question. ${best.slice(0, 3).map((memory) => `“${memory.title}”${memory.summary ? ` — ${memory.summary}` : ` — ${memory.content.slice(0, 180)}${memory.content.length > 180 ? "…" : ""}`}`).join(" ")}`
          : "I couldn't find a clear answer in your saved notes. These are the closest recent memories in your archive; open a source or try a more specific topic.";
      }
      return { answer, mode, sources };
    }),
  }),
  collections: router({
    list: protectedProcedure.query(async ({ ctx }) => { await seedSampleDataOnce(ctx.user.id); return getCollections(ctx.user.id); }),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(500).default(""), color: z.enum(["violet", "cyan", "blue", "rose", "amber"]).default("violet") })).mutation(async ({ ctx, input }) => ({ id: await createCollection(ctx.user.id, input) })),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await deleteCollection(ctx.user.id, input.id); return { success: true }; }),
  }),
});

export type AppRouter = typeof appRouter;
