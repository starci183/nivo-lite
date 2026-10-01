/**
 * Embeddings over an OpenAI-compatible `POST {base}/embeddings`. 1536 dimensions (pgvector column size).
 * Env: EMBEDDING_API_KEY (falls back to OPENROUTER_API_KEY, OPENAI_API_KEY, then the key used for the chat model),
 * EMBEDDING_BASE_URL (default https://openrouter.ai/api/v1), EMBEDDING_MODEL (default openai/text-embedding-3-small).
 * Never throws: when no key is set or the provider fails, callers get null and fall back to full-text search.
 */
import { recordUsage, usageScope, type ProviderUsage } from "../usage";

export const EMBEDDING_DIMS = 1536;

const settings = () => {
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "";
  return {
    apiKey,
    baseUrl: (process.env.EMBEDDING_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
    model: process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small",
  };
};

export const embeddingsConfigured = (): boolean => settings().apiKey.length > 0;

const BATCH = 32;

/** One vector per text (same order), or null when embeddings are unavailable. */
export const embedTexts = async (texts: ReadonlyArray<string>, timeoutMs = 20_000): Promise<Array<Array<number>> | null> => {
  const { apiKey, baseUrl, model } = settings();
  if (!apiKey || texts.length === 0) return null;
  const out: Array<Array<number>> = [];
  try {
    for (let i = 0; i < texts.length; i += BATCH) {
      const input = texts.slice(i, i + BATCH).map((t) => t.slice(0, 8000));
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Title": "NIVO OS" },
        body: JSON.stringify({ model, input }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) {
        console.error(`embeddings provider ${res.status}: ${(await res.text()).slice(0, 200).replace(/\s+/g, " ")}`);
        return null;
      }
      const body = (await res.json()) as { data?: Array<{ index?: number; embedding?: Array<number> }>; usage?: ProviderUsage };
      const scope = usageScope();
      if (scope) {
        // Metered like every model call (kind 'embedding'); the provider's usage when present, else an estimate from the input size.
        await recordUsage({ workspaceId: scope.workspaceId, kind: "embedding", module: scope.module ?? "knowledge", model, usage: body.usage, promptChars: input.reduce((n, t) => n + t.length, 0) });
      }
      const rows = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      if (rows.length !== input.length || rows.some((r) => r.embedding?.length !== EMBEDDING_DIMS)) {
        console.error("embeddings provider returned an unexpected shape");
        return null;
      }
      for (const r of rows) out.push(r.embedding as Array<number>);
    }
    return out;
  } catch (e) {
    console.error("embeddings failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
};

export const embedText = async (text: string, timeoutMs = 4_000): Promise<Array<number> | null> => (await embedTexts([text], timeoutMs))?.[0] ?? null;

/** pgvector text form, accepted by PostgREST for vector columns and rpc arguments. */
export const toVector = (v: ReadonlyArray<number>): string => `[${v.join(",")}]`;
