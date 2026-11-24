import {
  index,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Existing starter authentication table. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const memories = mysqlTable("memories", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  seedKey: varchar("seedKey", { length: 100 }),
  title: varchar("title", { length: 240 }).notNull(),
  content: longtext("content").notNull(),
  source: text("source"),
  sourceUrl: text("sourceUrl"),
  sourceType: mysqlEnum("sourceType", ["note", "text", "url", "image", "screenshot"]).default("note").notNull(),
  category: varchar("category", { length: 80 }).default("Unsorted").notNull(),
  summary: text("summary"),
  keyConcepts: json("keyConcepts").$type<string[]>().notNull(),
  tags: json("tags").$type<string[]>().notNull(),
  attachmentData: longtext("attachmentData"),
  attachmentName: varchar("attachmentName", { length: 240 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("memories_owner_seed_unique").on(table.ownerId, table.seedKey)]);

/** Each undirected relationship is stored exactly once as min(id), max(id). */
export const memoryLinks = mysqlTable(
  "memory_links",
  {
    id: int("id").autoincrement().primaryKey(),
    memoryAId: int("memoryAId").notNull().references(() => memories.id, { onDelete: "cascade" }),
    memoryBId: int("memoryBId").notNull().references(() => memories.id, { onDelete: "cascade" }),
    relation: varchar("relation", { length: 120 }).default("related").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("memory_links_pair_unique").on(table.memoryAId, table.memoryBId)],
);

export const collections = mysqlTable("collections", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 24 }).default("violet").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const collectionMemories = mysqlTable(
  "collection_memories",
  {
    collectionId: int("collectionId").notNull().references(() => collections.id, { onDelete: "cascade" }),
    memoryId: int("memoryId").notNull().references(() => memories.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("collection_memories_pair_unique").on(table.collectionId, table.memoryId)],
);

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull().default("New conversation"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("conversations_owner_updated_idx").on(table.ownerId, table.updatedAt)]);

export const conversationMessages = mysqlTable("conversation_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["question", "answer"]).notNull(),
  content: longtext("content").notNull(),
  citedMemoryIds: json("citedMemoryIds").$type<number[] | { memoryIds: number[]; mode: "live" | "demo" }>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("conversation_messages_owner_conversation_created_idx").on(table.ownerId, table.conversationId, table.createdAt),
]);

/** Records one-time initialization independently of user deletions. */
export const workspaceMeta = mysqlTable("workspace_meta", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type Collection = typeof collections.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
