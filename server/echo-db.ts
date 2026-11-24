import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import {
  collectionMemories,
  collections,
  conversationMessages,
  conversations,
  memories,
  memoryLinks,
} from "../drizzle/schema";
import { getDb } from "./db";
import { parseCitationMetadata } from "./recall-utils";

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
    messages: messages.map(({ ownerId: _messageOwnerId, ...message }) => ({ ...message, ...parseCitationMetadata(message.citedMemoryIds) })),
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
  return rows.map(({ ownerId: _ownerId, ...message }) => ({ ...message, ...parseCitationMetadata(message.citedMemoryIds) }));
}

export async function appendConversationTurn(
  ownerId: number,
  input: { conversationId?: number; question: string; answer: string; citedMemoryIds: number[]; mode: "live" | "demo" },
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    let conversationId = input.conversationId;
    if (conversationId !== undefined) {
      const owned = await tx.select({ id: conversations.id }).from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.ownerId, ownerId))).limit(1);
      if (!owned.length) throw new Error("Conversation not found.");
    } else {
      const created = await tx.insert(conversations).values({
        ownerId,
        title: input.question.trim().slice(0, 240) || "New conversation",
      });
      conversationId = insertedId(created);
    }

    const citedMemoryIds = [...new Set(input.citedMemoryIds)];
    if (citedMemoryIds.length) {
      const ownedMemories = await tx.select({ id: memories.id }).from(memories)
        .where(and(eq(memories.ownerId, ownerId), isNull(memories.seedKey), inArray(memories.id, citedMemoryIds)));
      if (ownedMemories.length !== citedMemoryIds.length) throw new Error("One or more cited memories are not available.");
    }

    await tx.insert(conversationMessages).values([
      { conversationId, ownerId, role: "question", content: input.question, citedMemoryIds: [] },
      { conversationId, ownerId, role: "answer", content: input.answer, citedMemoryIds: { memoryIds: citedMemoryIds, mode: input.mode } },
    ]);
    await tx.update(conversations).set({ updatedAt: new Date() })
      .where(and(eq(conversations.id, conversationId), eq(conversations.ownerId, ownerId)));
    return conversationId;
  });
}

export async function getMemories(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select({
    id: memories.id, ownerId: memories.ownerId, seedKey: memories.seedKey, title: memories.title,
    content: memories.content, source: memories.source, sourceUrl: memories.sourceUrl, sourceType: memories.sourceType,
    category: memories.category, summary: memories.summary, keyConcepts: memories.keyConcepts, tags: memories.tags,
    attachmentName: memories.attachmentName, hasAttachment: memories.attachmentData, createdAt: memories.createdAt,
    updatedAt: memories.updatedAt,
  }).from(memories).where(and(eq(memories.ownerId, ownerId), isNull(memories.seedKey))).orderBy(desc(memories.createdAt));
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
      hasAttachment: Boolean(row.hasAttachment),
      tags: Array.isArray(row.tags) ? row.tags : [],
      keyConcepts: Array.isArray(row.keyConcepts) ? row.keyConcepts : [],
      relatedIds: links.filter((link) => (link.memoryAId === row.id && ids.has(link.memoryBId)) || (link.memoryBId === row.id && ids.has(link.memoryAId)))
        .map((link) => link.memoryAId === row.id ? link.memoryBId : link.memoryAId),
      collectionIds: membership.filter((item) => item.memoryId === row.id).map((item) => item.collectionId),
    };
  });
}

export async function getMemoryAttachment(ownerId: number, memoryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select({ attachmentData: memories.attachmentData, attachmentName: memories.attachmentName })
    .from(memories).where(and(eq(memories.id, memoryId), eq(memories.ownerId, ownerId))).limit(1);
  return rows[0] ?? null;
}

export async function getLegacySampleMemories(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select({
    id: memories.id, title: memories.title, content: memories.content, source: memories.source,
    sourceUrl: memories.sourceUrl, sourceType: memories.sourceType, category: memories.category,
    summary: memories.summary, tags: memories.tags, attachmentName: memories.attachmentName,
    hasAttachment: memories.attachmentData, createdAt: memories.createdAt,
  }).from(memories).where(and(eq(memories.ownerId, ownerId), isNotNull(memories.seedKey))).orderBy(desc(memories.createdAt));
  return rows.map((row) => ({ ...row, tags: Array.isArray(row.tags) ? row.tags : [], hasAttachment: Boolean(row.hasAttachment) }));
}

export async function promoteLegacySample(ownerId: number, memoryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select({ id: memories.id }).from(memories)
    .where(and(eq(memories.id, memoryId), eq(memories.ownerId, ownerId), isNotNull(memories.seedKey))).limit(1);
  if (!rows.length) return false;
  await db.update(memories).set({ seedKey: null }).where(and(eq(memories.id, memoryId), eq(memories.ownerId, ownerId)));
  return true;
}

export async function createMemory(ownerId: number, input: MemoryInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const { relatedIds = [], collectionIds = [], ...fields } = input;
  const cleanedRelated = [...new Set(relatedIds.filter((relatedId) => Number.isInteger(relatedId) && relatedId > 0))];
  const cleanedCollections = [...new Set(collectionIds.filter((collectionId) => Number.isInteger(collectionId) && collectionId > 0))];
  return db.transaction(async (tx) => {
    if (cleanedRelated.length) {
      const existing = await tx.select({ id: memories.id }).from(memories)
        .where(and(eq(memories.ownerId, ownerId), inArray(memories.id, cleanedRelated)));
      if (existing.length !== cleanedRelated.length) throw new Error("One or more related memories are not available.");
    }
    if (cleanedCollections.length) {
      const existing = await tx.select({ id: collections.id }).from(collections)
        .where(and(eq(collections.ownerId, ownerId), inArray(collections.id, cleanedCollections)));
      if (existing.length !== cleanedCollections.length) throw new Error("One or more collections are not available.");
    }
    const id = insertedId(await tx.insert(memories).values({ ...fields, ownerId }));
    if (cleanedRelated.length) {
      const links = cleanedRelated.filter((relatedId) => relatedId !== id).map((relatedId) => ({
        memoryAId: Math.min(id, relatedId), memoryBId: Math.max(id, relatedId), relation: "related",
      }));
      if (links.length) await tx.insert(memoryLinks).values(links).onDuplicateKeyUpdate({ set: { relation: "related" } });
    }
    if (cleanedCollections.length) {
      const memberships = cleanedCollections.map((collectionId) => ({ collectionId, memoryId: id }));
      await tx.insert(collectionMemories).values(memberships).onDuplicateKeyUpdate({ set: { memoryId: id } });
    }
    return id;
  });
}

export async function updateMemory(ownerId: number, id: number, input: Partial<MemoryInput>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const { relatedIds, collectionIds, ...fields } = input;
  await db.transaction(async (tx) => {
    const owned = await tx.select({ id: memories.id }).from(memories).where(and(eq(memories.id, id), eq(memories.ownerId, ownerId))).limit(1);
    if (!owned.length) throw new Error("Memory not found.");
    const cleanedRelated = relatedIds === undefined ? undefined : [...new Set(relatedIds.filter((relatedId) => Number.isInteger(relatedId) && relatedId > 0 && relatedId !== id))];
    const cleanedCollections = collectionIds === undefined ? undefined : [...new Set(collectionIds.filter((collectionId) => Number.isInteger(collectionId) && collectionId > 0))];
    if (cleanedRelated?.length) {
      const existing = await tx.select({ id: memories.id }).from(memories)
        .where(and(eq(memories.ownerId, ownerId), inArray(memories.id, cleanedRelated)));
      if (existing.length !== cleanedRelated.length) throw new Error("One or more related memories are not available.");
    }
    if (cleanedCollections?.length) {
      const existing = await tx.select({ id: collections.id }).from(collections)
        .where(and(eq(collections.ownerId, ownerId), inArray(collections.id, cleanedCollections)));
      if (existing.length !== cleanedCollections.length) throw new Error("One or more collections are not available.");
    }
    if (Object.keys(fields).length) await tx.update(memories).set(fields).where(and(eq(memories.id, id), eq(memories.ownerId, ownerId)));
    if (cleanedRelated !== undefined) {
      await tx.delete(memoryLinks).where(or(eq(memoryLinks.memoryAId, id), eq(memoryLinks.memoryBId, id)));
      const links = cleanedRelated.map((relatedId) => ({
        memoryAId: Math.min(id, relatedId), memoryBId: Math.max(id, relatedId), relation: "related",
      }));
      if (links.length) await tx.insert(memoryLinks).values(links).onDuplicateKeyUpdate({ set: { relation: "related" } });
    }
    if (cleanedCollections !== undefined) {
      await tx.delete(collectionMemories).where(eq(collectionMemories.memoryId, id));
      if (cleanedCollections.length) {
        const memberships = cleanedCollections.map((collectionId) => ({ collectionId, memoryId: id }));
        await tx.insert(collectionMemories).values(memberships).onDuplicateKeyUpdate({ set: { memoryId: id } });
      }
    }
  });
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
  const ownMemoryIds = new Set((await db.select({ id: memories.id }).from(memories)
    .where(and(eq(memories.ownerId, ownerId), isNull(memories.seedKey)))).map((row) => row.id));
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

export function getDemoMemories() {
  const ids = new Map(samples.map((sample, index) => [sample.sampleKey, -(index + 1)]));
  const connections: Array<[string, string]> = [
    ["attention-is-all-you-need", "embedding-search-notes"], ["attention-is-all-you-need", "ai-product-trust"],
    ["building-a-second-brain", "visual-thinking-graphs"], ["building-a-second-brain", "embedding-search-notes"],
    ["zero-trust-security", "ai-product-trust"],
  ];
  const links = new Map<number, number[]>();
  for (const [firstKey, secondKey] of connections) {
    const first = ids.get(firstKey)!; const second = ids.get(secondKey)!;
    links.set(first, [...(links.get(first) ?? []), second]);
    links.set(second, [...(links.get(second) ?? []), first]);
  }
  return samples.map(({ sampleKey, ...memory }) => {
    const id = ids.get(sampleKey)!;
    return {
      id, ...memory, attachmentName: null, hasAttachment: false, updatedAt: memory.createdAt,
      relatedIds: links.get(id) ?? [], collectionIds: [],
    };
  });
}
