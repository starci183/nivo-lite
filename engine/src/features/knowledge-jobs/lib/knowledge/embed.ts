// PORTED from src/lib/knowledge/embed.ts (keep in sync by hand). Same request, batch size, dimensions and metering (usage kind 'embedding').
// Differences: settings come from KnowledgeJobsOptions (main.ts reads the env), the workspace is passed explicitly instead of the
// AsyncLocalStorage usage scope, and an optional onBatch callback reports progress.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmbeddingSettings } from "../../knowledge-jobs.config";
import { recordUsage, type ProviderUsage } from "../usage";

export const EMBEDDING_DIMS = 1536;
export const MAX_EMBED_CHARS = 8000;
const BATCH = 32;

export type EmbedMeter = { readonly db: SupabaseClient; readonly workspaceId: string; readonly module: string };

/**
 * One vector per text (same order), or null when embeddings are unavailable (no key, provider error, unexpected shape). Never throws.
 * Every batch is metered against the workspace like the web does.
 */
export const embedTexts = async (
  settings: EmbeddingSettings, meter: EmbedMeter, texts: ReadonlyArray<string>,
  opts: { readonly timeoutMs?: number; readonly onBatch?: (done: number, total: number) => Promise<void> | void } = {},
): Promise<Array<Array<number>> | null> => {
  const { apiKey, baseUrl, model } = settings;
  if (!apiKey || texts.length === 0) return null;
  const out: Array<Array<number>> = [];
  try {
    for (let i = 0; i < texts.length; i += BATCH) {
      const input = texts.slice(i, i + BATCH).map((t) => t.slice(0, MAX_EMBED_CHARS));
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Title": "NIVO OS" },
        body: JSON.stringify({ model, input, dimensions: EMBEDDING_DIMS }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      });
      if (!res.ok) {
        console.error(`embeddings provider ${res.status}: ${(await res.text()).slice(0, 200).replace(/\s+/g, " ")}`);
        return null;
      }
      const body = (await res.json()) as { data?: Array<{ index?: number; embedding?: Array<number> }>; usage?: ProviderUsage };
      await recordUsage(meter.db, { workspaceId: meter.workspaceId, kind: "embedding", module: meter.module, model, usage: body.usage, promptChars: input.reduce((n, t) => n + t.length, 0) });
      const rows = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      if (rows.length !== input.length || rows.some((r) => r.embedding?.length !== EMBEDDING_DIMS)) {
        console.error("embeddings provider returned an unexpected shape");
        return null;
      }
      for (const r of rows) out.push(r.embedding as Array<number>);
      await opts.onBatch?.(out.length, texts.length);
    }
    return out;
  } catch (e) {
    console.error("embeddings failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
};

/** pgvector text form, accepted by PostgREST for vector columns and rpc arguments. */
export const toVector = (v: ReadonlyArray<number>): string => `[${v.join(",")}]`;
