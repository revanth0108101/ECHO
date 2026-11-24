import { and, desc, eq, inArray, or } from "drizzle-orm";
import {
  collectionMemories,
  collections,
  conversationMessages,
  conversations,
  memories,
  memoryLinks,
  workspaceMeta,
} from "../drizzle/schema";
import { getDb } from "./db";

export type MemorySourceType = "note" | "text" | "url" | "image" | "screenshot";
export type MemoryInput = {
  title: string;
  content: string;
  seedKey?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  sourceType: MemorySourceType;
  category: string;
  tags: string[];
  summary?: string | null;
  keyConcepts: string[];
  attachmentData?: string | null;
  attachmentName?: string | null;
  createdAt?: Date;
  relatedIds?: number[];
  collectionIds?: number[];
};

export type MemoryWithLinks = Awaited<ReturnType<typeof getMemories>>[number];
let seedPromises = new Map<number, Promise<void>>();

function insertedId(result: unknown): number {
  const first = Array.isArray(result) ? result[0] as { insertId?: number | bigint } | undefined : undefined;
  const object = result as { insertId?: number | bigint } | undefined;
  const id = first?.insertId ?? object?.insertId;
  if (id === undefined) throw new Error("Database did not return the new record id");
  return Number(id);
}

export async function listConversations(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(conversations).where(eq(conversations.ownerId, ownerId)).orderBy(desc(conversations.updatedAt));
  return rows.map(({ ownerId: _ownerId, ...conversation }) => conversation);
}

export async function createConversation(ownerId: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(conversations).values({ ownerId, title });
  return insertedId(result);
}

export async function getConversation(ownerId: number, conversationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.ownerId, ownerId))).limit(1);
  const row = rows[0];
  if (!row) return null;
  const messages = await db.select().from(conversationMessages)
    .where(and(eq(conversationMessages.conversationId, conversationId), eq(conversationMessages.ownerId, ownerId)))
    .orderBy(conversationMessages.createdAt, conversationMessages.id);
  const { ownerId: _ownerId, ...conversation } = row;
  return {
    ...conversation,
    messages: messages.map(({ ownerId: _messageOwnerId, ...message }) => ({
      ...message,
      citedMemoryIds: Array.isArray(message.citedMemoryIds) ? message.citedMemoryIds : [],
    })),
  };
}

export async function getConversationMessages(ownerId: number, conversationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const owned = await db.select({ id: conversations.id }).from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.ownerId, ownerId))).limit(1);
  if (!owned.length) return null;
  const rows = await db.select().from(conversationMessages)
    .where(and(eq(conversationMessages.conversationId, conversationId), eq(conversationMessages.ownerId, ownerId)))
    .orderBy(conversationMessages.createdAt, conversationMessages.id);
  return rows.map(({ ownerId: _ownerId, ...message }) => ({
    ...message,
    citedMemoryIds: Array.isArray(message.citedMemoryIds) ? message.citedMemoryIds : [],
  }));
}

export async function appendConversationTurn(
  ownerId: number,
  input: { conversationId?: number; question: string; answer: string; citedMemoryIds: number[] },
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  let conversationId = input.conversationId;
  if (conversationId !== undefined) {
    const owned = await db.select({ id: conversations.id }).from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.ownerId, ownerId))).limit(1);
    if (!owned.length) throw new Error("Conversation not found.");
  } else {
    const created = await db.insert(conversations).values({
      ownerId,
      title: input.question.trim().slice(0, 240) || "New conversation",
    });
    conversationId = insertedId(created);
  }

  const citedMemoryIds = [...new Set(input.citedMemoryIds)];
  if (citedMemoryIds.length) {
    const ownedMemories = await db.select({ id: memories.id }).from(memories)
      .where(and(eq(memories.ownerId, ownerId), inArray(memories.id, citedMemoryIds)));
    if (ownedMemories.length !== citedMemoryIds.length) throw new Error("One or more cited memories are not available.");
  }

  await db.insert(conversationMessages).values([
    { conversationId, ownerId, role: "question", content: input.question, citedMemoryIds: [] },
    { conversationId, ownerId, role: "answer", content: input.answer, citedMemoryIds },
  ]);
  await db.update(conversations).set({ updatedAt: new Date() })
    .where(and(eq(conversations.id, conversationId), eq(conversations.ownerId, ownerId)));
  return conversationId;
}

async function setLinks(ownerId: number, memoryId: number, relatedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const cleaned = [...new Set(relatedIds.filter((id) => Number.isInteger(id) && id > 0 && id !== memoryId))];
  await db.delete(memoryLinks).where(or(eq(memoryLinks.memoryAId, memoryId), eq(memoryLinks.memoryBId, memoryId)));
  if (!cleaned.length) return;
  const existing = await db.select({ id: memories.id }).from(memories).where(eq(memories.ownerId, ownerId));
  const valid = new Set(existing.map((row) => row.id));
  const values = cleaned.filter((id) => valid.has(id)).map((otherId) => ({
    memoryAId: Math.min(memoryId, otherId), memoryBId: Math.max(memoryId, otherId), relation: "related",
  }));
  if (values.length) await db.insert(memoryLinks).values(values).onDuplicateKeyUpdate({ set: { relation: "related" } });
}

async function setCollections(ownerId: number, memoryId: number, collectionIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(collectionMemories).where(eq(collectionMemories.memoryId, memoryId));
  const cleaned = [...new Set(collectionIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!cleaned.length) return;
  const existing = await db.select({ id: collections.id }).from(collections).where(eq(collections.ownerId, ownerId));
  const valid = new Set(existing.map((row) => row.id));
  const values = cleaned.filter((id) => valid.has(id)).map((collectionId) => ({ collectionId, memoryId }));
  if (values.length) await db.insert(collectionMemories).values(values).onDuplicateKeyUpdate({ set: { memoryId } });
}

export async function getMemories(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(memories).where(eq(memories.ownerId, ownerId)).orderBy(desc(memories.createdAt));
  const ids = new Set(rows.map((row) => row.id));
  const ownedIds = [...ids];
  const [links, membership] = ownedIds.length ? await Promise.all([
    db.select().from(memoryLinks).where(or(inArray(memoryLinks.memoryAId, ownedIds), inArray(memoryLinks.memoryBId, ownedIds))),
    db.select().from(collectionMemories).where(inArray(collectionMemories.memoryId, ownedIds)),
  ]) : [[], []];
  return rows.map((row) => {
    const { ownerId: _ownerId, seedKey: _seedKey, ...memory } = row;
    return {
      ...memory,
      tags: Array.isArray(row.tags) ? row.tags : [],
      keyConcepts: Array.isArray(row.keyConcepts) ? row.keyConcepts : [],
      relatedIds: links.filter((link) => (link.memoryAId === row.id && ids.has(link.memoryBId)) || (link.memoryBId === row.id && ids.has(link.memoryAId)))
        .map((link) => link.memoryAId === row.id ? link.memoryBId : link.memoryAId),
      collectionIds: membership.filter((item) => item.memoryId === row.id).map((item) => item.collectionId),
    };
  });
}

export async function createMemory(ownerId: number, input: MemoryInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const { relatedIds = [], collectionIds = [], ...fields } = input;
  const result = await db.insert(memories).values({ ...fields, ownerId });
  const id = insertedId(result);
  await Promise.all([setLinks(ownerId, id, relatedIds), setCollections(ownerId, id, collectionIds)]);
  return id;
}

export async function updateMemory(ownerId: number, id: number, input: Partial<MemoryInput>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const owned = await db.select({ id: memories.id }).from(memories).where(and(eq(memories.id, id), eq(memories.ownerId, ownerId))).limit(1);
  if (!owned.length) throw new Error("Memory not found.");
  const { relatedIds, collectionIds, ...fields } = input;
  if (Object.keys(fields).length) await db.update(memories).set(fields).where(and(eq(memories.id, id), eq(memories.ownerId, ownerId)));
  const jobs: Promise<unknown>[] = [];
  if (relatedIds !== undefined) jobs.push(setLinks(ownerId, id, relatedIds));
  if (collectionIds !== undefined) jobs.push(setCollections(ownerId, id, collectionIds));
  await Promise.all(jobs);
}

export async function deleteMemory(ownerId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(memories).where(and(eq(memories.id, id), eq(memories.ownerId, ownerId)));
}

export async function getCollections(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(collections).where(eq(collections.ownerId, ownerId)).orderBy(desc(collections.createdAt));
  const ownMemoryIds = new Set((await db.select({ id: memories.id }).from(memories).where(eq(memories.ownerId, ownerId))).map((row) => row.id));
  const collectionIds = rows.map((row) => row.id);
  const memberships = collectionIds.length ? await db.select().from(collectionMemories).where(inArray(collectionMemories.collectionId, collectionIds)) : [];
  return rows.map((row) => {
    const { ownerId: _ownerId, ...collection } = row;
    return { ...collection, memoryIds: memberships.filter((item) => item.collectionId === row.id && ownMemoryIds.has(item.memoryId)).map((item) => item.memoryId) };
  });
}

export async function createCollection(ownerId: number, input: { name: string; description: string; color: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(collections).values({ ...input, ownerId });
  return insertedId(result);
}

export async function deleteCollection(ownerId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(collections).where(and(eq(collections.id, id), eq(collections.ownerId, ownerId)));
}

const samples: Array<MemoryInput & { sampleKey: string }> = [
  {
    sampleKey: "attention-is-all-you-need", title: "Attention is all you need", source: "arXiv · research paper", sourceUrl: "https://arxiv.org/abs/1706.03762", sourceType: "url",
    content: "The Transformer architecture relies entirely on attention mechanisms, dispensing with recurrence and convolutions. Self-attention lets a model weigh the relevance of every token to every other token. This parallelizable design became a foundation for modern language models.",
    summary: "Transformers replace recurrence with self-attention, enabling parallel sequence modeling and powering modern language models.", category: "Artificial intelligence", tags: ["transformers", "attention", "research"], keyConcepts: ["self-attention", "parallel processing", "Transformer"], createdAt: new Date("2026-10-18T10:12:00Z"),
  },
  {
    sampleKey: "building-a-second-brain", title: "Building a second brain", source: "Personal note", sourceType: "note",
    content: "A useful knowledge system should lower the friction of saving ideas and raise the quality of connections later. Capture should preserve context: where an idea came from, why it mattered, and what it relates to. Organize by action or topic, not by an ever-growing folder tree.",
    summary: "A personal knowledge system succeeds when it preserves context, reduces capture friction, and helps ideas reconnect.", category: "Knowledge systems", tags: ["knowledge management", "workflow", "notes"], keyConcepts: ["capture", "context", "connections"], createdAt: new Date("2026-10-22T16:30:00Z"),
  },
  {
    sampleKey: "embedding-search-notes", title: "A note on semantic search", source: "Personal note", sourceType: "note",
    content: "Embeddings encode meaning as vectors so related ideas can be retrieved even when they do not share exact words. A hybrid search can combine lexical matching for precision with semantic similarity for conceptual recall. Always keep the original source available for verification.",
    summary: "Hybrid retrieval pairs exact keyword matching with embeddings to find conceptually related memories while preserving provenance.", category: "Artificial intelligence", tags: ["embeddings", "search", "retrieval"], keyConcepts: ["vector embeddings", "hybrid search", "provenance"], createdAt: new Date("2026-10-29T09:05:00Z"),
  },
  {
    sampleKey: "zero-trust-security", title: "Zero trust, in practice", source: "Security field guide", sourceUrl: "https://www.cloudflare.com/learning/security/glossary/what-is-zero-trust/", sourceType: "url",
    content: "Zero trust security treats every access request as untrusted until it is explicitly verified. Strong identity, least-privilege access, device health, and continuous evaluation work together. It is an operating model rather than a single product.",
    summary: "Zero trust is a security model built on explicit verification, least privilege, device posture, and continuous evaluation.", category: "Security", tags: ["zero trust", "identity", "security"], keyConcepts: ["least privilege", "continuous verification", "device posture"], createdAt: new Date("2026-11-03T13:45:00Z"),
  },
  {
    sampleKey: "visual-thinking-graphs", title: "Why visual thinking works", source: "Design notes", sourceType: "note",
    content: "Externalizing ideas into a visual space makes patterns easier to notice. A graph is useful when relationships matter as much as individual notes; it becomes most readable when clusters have meaning, labels are sparse, and the user can follow one path at a time.",
    summary: "Visual knowledge maps surface patterns when clusters are meaningful and relationships remain explorable rather than noisy.", category: "Design", tags: ["visual thinking", "knowledge graph", "design"], keyConcepts: ["visualization", "clusters", "relationships"], createdAt: new Date("2026-11-09T08:20:00Z"),
  },
  {
    sampleKey: "ai-product-trust", title: "Trust is an interface feature", source: "Product journal", sourceType: "text",
    content: "AI interfaces earn trust by showing what evidence informed an answer, separating certainty from speculation, and offering a clear path back to original sources. When a system is operating with a limited or simulated capability, that boundary should be visible to the user.",
    summary: "Source visibility, calibrated certainty, and honest capability labels are core parts of a trustworthy AI interface.", category: "Product thinking", tags: ["AI", "trust", "provenance"], keyConcepts: ["source attribution", "calibrated confidence", "AI transparency"], createdAt: new Date("2026-11-18T18:10:00Z"),
  },
];

export async function seedSampleDataOnce(ownerId: number) {
  if (!seedPromises.has(ownerId)) {
    const job = (async () => {
      const db = await getDb();
      if (!db) throw new Error("Database is not available");
      const markerKey = `sample-memories-v1-${ownerId}`;
      const marker = await db.select({ key: workspaceMeta.key }).from(workspaceMeta).where(eq(workspaceMeta.key, markerKey)).limit(1);
      if (marker.length) return;
      const ids = new Map<string, number>();
      for (const { sampleKey, ...record } of samples) {
        const existingMemory = await db.select({ id: memories.id }).from(memories)
          .where(and(eq(memories.ownerId, ownerId), eq(memories.seedKey, sampleKey))).limit(1);
        ids.set(sampleKey, existingMemory[0]?.id ?? await createMemory(ownerId, { ...record, seedKey: sampleKey }));
      }
      const linksById = new Map<number, number[]>();
      const connections: Array<[string, string]> = [
        ["attention-is-all-you-need", "embedding-search-notes"], ["attention-is-all-you-need", "ai-product-trust"],
        ["building-a-second-brain", "visual-thinking-graphs"], ["building-a-second-brain", "embedding-search-notes"],
        ["zero-trust-security", "ai-product-trust"],
      ];
      for (const [a, b] of connections) {
        const first = ids.get(a); const second = ids.get(b);
        if (first && second) {
          linksById.set(first, [...(linksById.get(first) ?? []), second]);
          linksById.set(second, [...(linksById.get(second) ?? []), first]);
        }
      }
      for (const [id, related] of linksById) await setLinks(ownerId, id, related);
      const existing = await db.select().from(collections).where(eq(collections.ownerId, ownerId));
      const collectionInputs = [
        { name: "AI & machine learning", description: "Models, retrieval, and the ideas behind intelligent systems.", color: "violet" },
        { name: "Reading list", description: "Sources worth coming back to.", color: "cyan" },
      ];
      const collectionIds: number[] = [];
      for (const input of collectionInputs) {
        const match = existing.find((row) => row.name === input.name);
        if (match) collectionIds.push(match.id);
        else collectionIds.push(await createCollection(ownerId, input));
      }
      for (const key of ["attention-is-all-you-need", "embedding-search-notes", "ai-product-trust"]) {
        const id = ids.get(key); if (id) await setCollections(ownerId, id, [collectionIds[0]!]);
      }
      for (const key of ["attention-is-all-you-need", "zero-trust-security"]) {
        const id = ids.get(key); if (id) await setCollections(ownerId, id, [collectionIds[1]!]);
      }
      await db.insert(workspaceMeta).values({ key: markerKey, value: "initialized" }).onDuplicateKeyUpdate({ set: { value: "initialized" } });
    })();
    seedPromises.set(ownerId, job);
    job.catch(() => seedPromises.delete(ownerId));
  }
  await seedPromises.get(ownerId);
}
