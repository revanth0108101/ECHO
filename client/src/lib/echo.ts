import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export type EchoOutputs = inferRouterOutputs<AppRouter>;
export type MemoryRecord = EchoOutputs["memories"]["list"][number];
export type CollectionRecord = EchoOutputs["collections"]["list"][number];
export type MemoryDraft = {
  title: string;
  content: string;
  source: string;
  sourceUrl: string;
  sourceType: "note" | "text" | "url" | "image" | "screenshot";
  category: string;
  tags: string[];
  attachmentData: string | null;
  attachmentName: string | null;
  createdAt: string;
  relatedIds: number[];
  collectionIds: number[];
};

export const CATEGORY_OPTIONS = ["Artificial intelligence", "Knowledge systems", "Security", "Design", "Product thinking", "Ideas & notes"];
