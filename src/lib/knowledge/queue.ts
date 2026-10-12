"use client"

import type { SupabaseClient } from "@supabase/supabase-js"
import { supabaseBrowser } from "../supabase/browser"
import type { ModuleKey } from "../modules-shared"
import type { KnowledgeSource, SourceKind, SourceStatus, Visibility } from "./shared"

/**
 * Browser side of the document job queue. The browser only uploads; a worker reads, indexes and extracts facts in the background.
 *   enqueueSource   knowledge_enqueue_source: the source row (status queued) and its outbox job, in one transaction.
 *   uploadToBucket  a file into the private `knowledge-uploads` bucket, with real per-file progress.
 *   retrySource     knowledge_retry_source: put a failed source back on the queue.
 *   useLiveSources  (live.ts) keeps lists in step with knowledge_sources through realtime.
 */
export const UPLOAD_BUCKET = "knowledge-uploads"

export type EnqueueMeta = {
  readonly topic: string | null
  readonly tags: ReadonlyArray<string>
  readonly visibility: Visibility
  readonly module: ModuleKey | null
  /** Where it came from: a folder, a ZIP, "Google Picker"... */
  readonly origin?: string | null
  /** The body of a written note or a Q&A list (kind text / faq). */
  readonly content?: string
}

export type EnqueueArgs = {
  readonly workspaceId: string
  readonly kind: SourceKind
  readonly title: string
  readonly storagePath?: string | null
  readonly url?: string | null
  readonly meta: EnqueueMeta
}

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>
const rpcOf = (sb: SupabaseClient): Rpc => (fn, args) => sb.rpc(fn, args)

/** Queue one source. Resolves to the new source id. */
export const enqueueSource = async (a: EnqueueArgs, sb: SupabaseClient = supabaseBrowser()): Promise<string> => {
  const { data, error } = await rpcOf(sb)("knowledge_enqueue_source", {
    p_workspace: a.workspaceId, p_kind: a.kind, p_title: a.title.slice(0, 160), p_storage_path: a.storagePath ?? null, p_url: a.url ?? null,
    p_meta: { topic: a.meta.topic, tags: a.meta.tags, visibility: a.meta.visibility, module: a.meta.module, origin: a.meta.origin ?? null, ...(a.meta.content !== undefined ? { content: a.meta.content } : {}) },
  })
  if (error) throw new Error(error.message)
  if (typeof data !== "string") throw new Error("enqueue")
  return data
}

export const retrySource = async (id: string, sb: SupabaseClient = supabaseBrowser()): Promise<void> => {
  const { error } = await rpcOf(sb)("knowledge_retry_source", { p_source: id })
  if (error) throw new Error(error.message)
}

/** Storage keys are plain: no folders, no spaces or marks that a path or URL could trip on. */
const safeName = (name: string): string => {
  const base = name.replace(/^.*[\\/]/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "")
  return (base || "file").slice(-120)
}

/**
 * Upload to `<workspaceId>/<uuid>/<filename>` through a signed upload URL, over XHR, so `onProgress` (0-100) is real bytes sent.
 * Resolves to the storage path to hand to {@link enqueueSource}.
 */
export const uploadToBucket = async (workspaceId: string, file: File, onProgress: (percent: number) => void, sb: SupabaseClient = supabaseBrowser()): Promise<string> => {
  const path = `${workspaceId}/${crypto.randomUUID()}/${safeName(file.name)}`
  const signed = await sb.storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path)
  if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "upload")
  const url = signed.data.signedUrl
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)))
    xhr.onerror = () => reject(new Error("upload"))
    xhr.onabort = () => reject(new Error("upload"))
    // The same body storage-js sends for uploadToSignedUrl.
    const form = new FormData()
    form.append("cacheControl", "3600")
    form.append("", file)
    xhr.send(form)
  })
  onProgress(100)
  return path
}

/* ------------------------------------------------------------------ live rows */

type LiveRow = {
  id: string; workspace_id: string; module: KnowledgeSource["module"]; kind: SourceKind; topic: string | null; tags: Array<string> | null
  visibility: Visibility; title: string; status: SourceStatus; error: string | null; chunk_count: number; progress: number | null
  created_by: string | null; created_at: string; updated_at: string
}

/** A realtime / list row -> the list shape (the long `content` column is never loaded in the browser). */
export const sourceFromRow = (r: LiveRow): KnowledgeSource => ({
  id: r.id, workspaceId: r.workspace_id, module: r.module, kind: r.kind, topic: r.topic, tags: r.tags ?? [], visibility: r.visibility, title: r.title, content: "",
  status: r.status, error: r.error, chunkCount: r.chunk_count ?? 0, progress: r.progress ?? 0, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
})

export const LIVE_COLUMNS = "id, workspace_id, module, kind, topic, tags, visibility, title, status, error, chunk_count, progress, created_by, created_at, updated_at"

export type { LiveRow }
