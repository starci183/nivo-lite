import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { blockedBy, withUsage } from "../usage"
import { embeddingModel, embeddingsConfigured, embedTexts, toVector } from "./embed"

/**
 * Re-embedding after the embedding model changed. Vectors of different models are never mixed: search only compares chunks whose
 * embedding_model is the model in use, so a chunk made by another model (or never embedded) is found by full-text only until this runs.
 *
 * Bounded by design so a page load never waits for it: `reembedStale` takes at most `batches` batches of {@link REEMBED_BATCH} chunks per call,
 * and the pages of /brain and /knowledge call it AFTER the response (next/server `after`). Each batch is a normal embedding call, metered as
 * usage kind "embedding" against the workspace; blockedBy(workspace, "embedding", { bulk: true }) is asked first, so with no credits left
 * nothing is spent and the chunks wait. A provider failure pauses the workspace for a few minutes instead of retrying on every page load.
 */

type Db = SupabaseClient

export const REEMBED_BATCH = 32
const PAUSE_MS = 5 * 60_000
const paused = new Map<string, number>()
const running = new Set<string>()

export type ReembedResult = { readonly embedded: number; readonly remaining: boolean; readonly blocked: boolean }

/** The chunks of a workspace made by another model than `model`, or with no vector yet. */
const staleFilter = (model: string): string => `embedding_model.is.null,embedding.is.null,embedding_model.neq."${model.replace(/"/g, "")}"`

/** How many chunks of the workspace still need (re-)embedding with the current model. */
export const staleChunkCount = async (db: Db, ws: string): Promise<number> => {
  const { count } = await db.from("knowledge_chunks").select("id", { count: "exact", head: true }).eq("workspace_id", ws).or(staleFilter(embeddingModel()))
  return count ?? 0
}

export const reembedStale = async (db: Db, ws: string, opts: { readonly batches?: number } = {}): Promise<ReembedResult> => {
  const none: ReembedResult = { embedded: 0, remaining: false, blocked: false }
  if (!embeddingsConfigured() || running.has(ws) || (paused.get(ws) ?? 0) > Date.now()) return none
  running.add(ws)
  try {
    const model = embeddingModel()
    if (await blockedBy(ws, "embedding", { bulk: true })) return { ...none, remaining: true, blocked: true }
    let embedded = 0
    for (let b = 0; b < (opts.batches ?? 2); b++) {
      const { data, error } = await db.from("knowledge_chunks").select("id, content").eq("workspace_id", ws).or(staleFilter(model)).order("created_at").limit(REEMBED_BATCH)
      if (error) throw new Error(error.message)
      const chunks = (data ?? []) as Array<{ id: string; content: string }>
      if (chunks.length === 0) return { embedded, remaining: false, blocked: false }
      const vectors = await withUsage({ workspaceId: ws, module: "knowledge" }, () => embedTexts(chunks.map((c) => c.content), 30_000))
      if (!vectors) {
        paused.set(ws, Date.now() + PAUSE_MS)
        return { embedded, remaining: true, blocked: false }
      }
      for (let i = 0; i < chunks.length; i += 8) {
        await Promise.all(chunks.slice(i, i + 8).map(async (c, j) => {
          const { error: e } = await db.from("knowledge_chunks").update({ embedding: toVector(vectors[i + j] as Array<number>), embedding_model: model }).eq("id", c.id)
          if (e) throw new Error(e.message)
        }))
      }
      embedded += chunks.length
      if (chunks.length < REEMBED_BATCH) return { embedded, remaining: false, blocked: false }
    }
    return { embedded, remaining: true, blocked: false }
  } catch (e) {
    console.error("re-embed failed:", e instanceof Error ? e.message : String(e))
    paused.set(ws, Date.now() + PAUSE_MS)
    return none
  } finally {
    running.delete(ws)
  }
}
