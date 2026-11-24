export const STOP_WORDS = new Set("the and for are was were with from this that into about your have has had not but all their then than them they what when where which while also can could should would will into out use using used its our you how why save saved idea ideas notes note memory memories from over under between because based after before onto than into does did".split(" "));

export function normalizeContent(text: string) {
  return text.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/)
    .filter((word) => (word.length > 2 || /^[a-z]{2,4}\d?$/i.test(word)) && !STOP_WORDS.has(word));
}

export function validateCitationMarkers(answer: string, allowedIds: Iterable<number>) {
  const allowed = new Set(allowedIds);
  const citedIds = [...new Set([...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])).filter((id) => allowed.has(id)))];
  const sanitizedAnswer = answer.replace(/\[(\d+)\]/g, (marker, rawId: string) => allowed.has(Number(rawId)) ? marker : "");
  return { answer: sanitizedAnswer, citedIds };
}

export function parseCitationMetadata(value: unknown) {
  if (Array.isArray(value)) {
    return { citedMemoryIds: value.filter((id): id is number => Number.isInteger(id)), modelMode: "unknown" as const };
  }
  if (value && typeof value === "object") {
    const metadata = value as { memoryIds?: unknown; mode?: unknown };
    return {
      citedMemoryIds: Array.isArray(metadata.memoryIds) ? metadata.memoryIds.filter((id): id is number => Number.isInteger(id)) : [],
      modelMode: metadata.mode === "live" || metadata.mode === "demo" ? metadata.mode : "unknown" as const,
    };
  }
  return { citedMemoryIds: [], modelMode: "unknown" as const };
}
