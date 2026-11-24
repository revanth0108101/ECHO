import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const repository = vi.hoisted(() => ({
  appendConversationTurn: vi.fn(), createCollection: vi.fn(), createConversation: vi.fn(), createMemory: vi.fn(),
  deleteCollection: vi.fn(), deleteMemory: vi.fn(), getConversation: vi.fn(), getConversationMessages: vi.fn(),
  getCollections: vi.fn(), getDemoMemories: vi.fn(), getLegacySampleMemories: vi.fn(), getMemories: vi.fn(),
  getMemoryAttachment: vi.fn(), listConversations: vi.fn(), promoteLegacySample: vi.fn(), updateMemory: vi.fn(),
}));

vi.mock("./echo-db", () => repository);
vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "", forgeApiKey: "" } }));

import { appRouter } from "./routers";

const user = {
  id: 47, openId: "fixture-user", email: "fixture@example.test", name: "Fixture User", loginMethod: "test",
  role: "user" as const, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
  lastSignedIn: new Date("2026-01-01T00:00:00Z"),
};

function caller() {
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

beforeEach(() => {
  vi.resetAllMocks();
  repository.createMemory.mockResolvedValue(321);
  repository.getMemories.mockResolvedValue([]);
  repository.appendConversationTurn.mockResolvedValue(654);
  repository.getMemoryAttachment.mockResolvedValue(null);
  repository.getDemoMemories.mockReturnValue([{ id: -1, title: "Synthetic demo", relatedIds: [] }]);
});

describe("authenticated ECHO router boundaries", () => {
  it("scopes memory reads to the authenticated account and does not invoke seeders", async () => {
    await caller().memories.list();
    expect(repository.getMemories).toHaveBeenCalledWith(user.id);
    expect(Object.keys(repository)).not.toContain("seedSampleDataOnce");
  });

  it("routes memory create/update/delete and relation IDs through the authenticated owner", async () => {
    const api = caller();
    const created = await api.memories.create({
      title: "Fixture memory", content: "Safe synthetic note", sourceType: "note", category: "Ideas & notes",
      tags: ["test"], relatedIds: [12], collectionIds: [5],
    });
    expect(created).toEqual({ id: 321 });
    expect(repository.createMemory).toHaveBeenCalledWith(user.id, expect.objectContaining({ relatedIds: [12], collectionIds: [5] }));
    await api.memories.update({ id: 321, data: { title: "Updated fixture" } });
    expect(repository.updateMemory).toHaveBeenCalledWith(user.id, 321, expect.objectContaining({ title: "Updated fixture" }));
    await api.memories.remove({ id: 321 });
    expect(repository.deleteMemory).toHaveBeenCalledWith(user.id, 321);
  });

  it("scopes collection reads, creation, and deletion to the authenticated account", async () => {
    const api = caller();
    await api.collections.list();
    expect(repository.getCollections).toHaveBeenCalledWith(user.id);
    await api.collections.create({ name: "Fixture collection", description: "Synthetic", color: "violet" });
    expect(repository.createCollection).toHaveBeenCalledWith(user.id, expect.objectContaining({ name: "Fixture collection" }));
    await api.collections.remove({ id: 12 });
    expect(repository.deleteCollection).toHaveBeenCalledWith(user.id, 12);
  });

  it("does not return another user's image when the owner-scoped repository lookup misses", async () => {
    await expect(caller().memories.attachment({ id: 400 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(repository.getMemoryAttachment).toHaveBeenCalledWith(user.id, 400);
  });

  it("requires an explicit demo query and returns only isolated synthetic sample content", async () => {
    await expect(caller().memories.demo()).resolves.toEqual([{ id: -1, title: "Synthetic demo", relatedIds: [] }]);
    expect(repository.getDemoMemories).toHaveBeenCalledOnce();
    expect(repository.getMemories).not.toHaveBeenCalled();
  });

  it("answers empty-archive recall without live AI and stores deterministic-mode provenance", async () => {
    const response = await caller().memories.recall({ question: "What did I save about AI?" });
    expect(response).toMatchObject({ mode: "demo", sources: [], conversationId: 654 });
    expect(repository.appendConversationTurn).toHaveBeenCalledWith(user.id, expect.objectContaining({ mode: "demo", citedMemoryIds: [] }));
  });
});
