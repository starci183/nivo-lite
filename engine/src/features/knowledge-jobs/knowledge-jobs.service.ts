import { Inject, Injectable, Logger } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE } from "../../platform/supabase/supabase.module";
import { FactsModel } from "./facts-model.service";
import { BlockedCreditsError, JobProducer, KNOWLEDGE_UPLOAD_BUCKET, PermanentJobError, isUnrecoverable, type JobContext, type JobName, type JobPayloads, type SourceStatus } from "../../platform/pgmq";
import { KNOWLEDGE_JOBS_OPTIONS, type KnowledgeJobsOptions } from "./knowledge-jobs.config";
import { extractDocument, FactsBlocked, FactsRetry, markExtractionFailed } from "./lib/brain/doc-facts";
import { resolveGapsForDocument } from "./lib/brain/gaps";
import { chunkText } from "./lib/knowledge/chunk";
import { linkErrorCode } from "./lib/knowledge/drive";
import { embedTexts, toVector } from "./lib/knowledge/embed";
import { fileTextKind, sniffTextKind, textFromBytes } from "./lib/knowledge/extract";
import { fetchUrlDoc } from "./lib/knowledge/fetch-url";
import { MAX_SOURCE_CHARS } from "./lib/knowledge/limits";
import { blockedBy } from "./lib/usage";

type Db = SupabaseClient;

type SourceRow = {
  id: string; workspace_id: string; module: string | null; kind: "text" | "faq" | "file" | "url"; topic: string | null; visibility: "public" | "internal";
  title: string; content: string; status: SourceStatus; error: string | null; chunk_count: number; storage_path: string | null; source_url: string | null;
  created_by: string | null; updated_at: string;
};

/** The bucket's own limit (job_outbox migration: file_size_limit 12582912). */
const MAX_UPLOAD_BYTES = 12_582_912;
/** Above this many passages a document is a BULK embedding: it stops when the workspace has no credits left (src/lib/knowledge/index.ts). */
const BULK_CHUNKS = 40;
/** Re-embed: batches of 32 chunks (src/lib/knowledge/reembed.ts REEMBED_BATCH); one job does at most this many before handing over to a follow-up job. */
const REEMBED_BATCH = 32;
const REEMBED_MAX_BATCHES = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const now = () => new Date().toISOString();
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const NO_CREDITS_INDEX = "Hết credit: chưa tạo được vector ngữ nghĩa cho tài liệu lớn này (vẫn tìm được theo từ khóa). Nạp thêm credit tại Credit & gói (/billing) rồi bấm Thử lại.";
const NO_CREDITS_FACTS = "Hết credit: tài liệu đã lưu và tìm được, nhưng NIVO chưa đọc được các sự thật trong đó. Nạp thêm credit tại Credit & gói (/billing) rồi bấm Thử lại.";

/** A reason the source can never be read as it is (bad type, too big, empty, unreadable, not shared): status failed, no retry. */
class PermanentSourceError extends Error {}

/**
 * Network-ish failures are worth retrying: an HTTP status of 0 (network / timeout), 408, 425, 429 or 5xx on the error, a fetch TypeError, an abort or
 * timeout, or a storage error that is not "not found". Everything else (link error codes, the Vietnamese reasons of the readers) is permanent.
 */
const isRetryable = (e: unknown): boolean => {
  if (e instanceof PermanentSourceError) return false;
  if (linkErrorCode(msg(e))) return false;
  const status = (e as { status?: unknown }).status;
  if (typeof status === "number") return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
  const name = (e as { name?: unknown }).name;
  return name === "AbortError" || name === "TimeoutError" || (e instanceof TypeError && /fetch/i.test(e.message)) || (e as { retryable?: boolean }).retryable === true;
};

const isLastAttempt = (job: JobContext): boolean => job.isFinalAttempt;

const payloadOf = (job: JobContext<"knowledge.index" | "knowledge.facts">): { sourceId: string; workspaceId: string } => {
  const d = (job.payload ?? {}) as Record<string, unknown>;
  if (typeof d.sourceId !== "string" || !UUID.test(d.sourceId) || typeof d.workspaceId !== "string" || !UUID.test(d.workspaceId)) {
    throw new PermanentJobError(`${job.name}: payload needs sourceId and workspaceId (uuid)`);
  }
  return { sourceId: d.sourceId, workspaceId: d.workspaceId };
};

/**
 * The three knowledge jobs. Tenant isolation: every query is scoped by BOTH the source id and the workspace id of the payload, which the outbox
 * row was written with by server code (knowledge_enqueue_source / job_enqueue, service role or a verified manager), never by a browser.
 */
@Injectable()
export class KnowledgeJobsService {
  private readonly log = new Logger(KnowledgeJobsService.name);

  constructor(
    @Inject(SUPABASE) private readonly db: Db,
    @Inject(KNOWLEDGE_JOBS_OPTIONS) private readonly options: KnowledgeJobsOptions,
    private readonly model: FactsModel,
    private readonly producer: JobProducer,
  ) {}

  /* ------------------------------------------------------------------ shared */

  private async load(sourceId: string, workspaceId: string): Promise<SourceRow | null> {
    const { data, error } = await this.db.from("knowledge_sources").select("*").eq("id", sourceId).eq("workspace_id", workspaceId).maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { retryable: true });
    return (data as SourceRow | null) ?? null;
  }

  private async patch(src: SourceRow, row: Partial<Pick<SourceRow, "status" | "error" | "chunk_count" | "content" | "title">> & { progress?: number }): Promise<void> {
    const { error } = await this.db.from("knowledge_sources").update({ ...row, updated_at: now() }).eq("id", src.id).eq("workspace_id", src.workspace_id);
    if (error) throw Object.assign(new Error(error.message), { retryable: true });
  }

  /** Progress only: best effort, never fails the job. */
  private progress(src: SourceRow, progress: number): Promise<void> {
    return this.patch(src, { progress: Math.max(0, Math.min(100, Math.round(progress))) }).catch(() => undefined);
  }

  /** Chained jobs go through the platform producer (job_enqueue: outbox row + pgmq message, deduplicated on `dedupe`). */
  private async enqueue<N extends JobName>(workspaceId: string, name: N, payload: JobPayloads[N], dedupe: string): Promise<void> {
    await this.producer.enqueue(name, payload, dedupe, workspaceId);
  }

  /** The workspace's OpenClaw agents carry knowledge in their files: resync them (enqueueWorkspaceSync of the web). Best effort. */
  private async syncAgents(workspaceId: string): Promise<void> {
    const { error } = await this.db.rpc("engine_enqueue_workspace_sync", { p_workspace: workspaceId });
    if (error) this.log.warn(`workspace sync enqueue failed: ${error.message}`);
  }

  /* ------------------------------------------------------------------ knowledge.index */

  async index(job: JobContext<"knowledge.index">): Promise<void> {
    const { sourceId, workspaceId } = payloadOf(job);
    const src = await this.load(sourceId, workspaceId);
    if (!src) return; // deleted meanwhile
    // Idempotent: done or past this stage, or closed (a retry is a NEW job, written by knowledge_retry_source after it sets status queued).
    if (src.status === "ready" || src.status === "extracting_facts" || src.status === "failed" || src.status === "blocked_credits") return;

    try {
      await this.patch(src, { status: "reading", error: null, progress: 5 });
      const { text, title } = await this.read(src);
      const content = text.trim();
      if (!content) throw new PermanentSourceError("Nội dung đang trống.");
      if (content.length > MAX_SOURCE_CHARS) throw new PermanentSourceError(`Nội dung dài quá ${MAX_SOURCE_CHARS.toLocaleString("vi-VN")} ký tự. Hãy tách thành nhiều nguồn.`);
      src.content = content;
      if (title) src.title = title;
      await this.patch(src, { status: "indexing", content, title: src.title, progress: 20 });
      await this.chunkAndEmbed(src);
    } catch (e) {
      if (isUnrecoverable(e)) throw e;
      const retry = isRetryable(e);
      if (retry && !isLastAttempt(job)) {
        this.log.warn(`knowledge.index ${sourceId}: ${msg(e)} (attempt ${job.attempt}, will retry)`);
        throw e instanceof Error ? e : new Error(msg(e));
      }
      const reason = (retry ? `Không đọc được nguồn sau nhiều lần thử: ${msg(e)}` : msg(e)).slice(0, 400);
      await this.patch(src, { status: "failed", error: reason }).catch((x: unknown) => this.log.error(`knowledge.index ${sourceId}: could not mark failed: ${msg(x)}`));
      throw new PermanentJobError(reason);
    }

    // Indexed: the facts job is enqueued (idempotent per index job: a retried index job finds its own outbox row), THEN the status moves.
    await this.enqueue(workspaceId, "knowledge.facts", { sourceId, workspaceId }, `knowledge.facts:${sourceId}:${job.id}`);
    await this.patch(src, { status: "extracting_facts", progress: 85 });
  }

  /** The text of the source, by kind. URL sources may also bring a better title (the page or Drive file name) when none was given. */
  private async read(src: SourceRow): Promise<{ text: string; title: string | null }> {
    if (src.kind === "text" || src.kind === "faq") return { text: src.content, title: null };
    if (src.kind === "file") {
      if (!src.storage_path) {
        // A file source written by the old synchronous path already holds its text.
        if (src.content.trim()) return { text: src.content, title: null };
        throw new PermanentSourceError("Không tìm thấy tệp đã tải lên.");
      }
      const name = src.storage_path.replace(/^.*\//, "");
      const kindByName = fileTextKind(name);
      // A known extension decides; a name without one is sniffed after the download; any other extension is refused before downloading.
      if (!kindByName && /\.[a-z0-9]+$/i.test(name)) throw new PermanentSourceError("Chỉ nhận .txt, .md, .csv, .pdf, .docx, .xlsx hoặc .pptx.");
      const { data, error } = await this.db.storage.from(KNOWLEDGE_UPLOAD_BUCKET).download(src.storage_path);
      if (error || !data) {
        const m = error?.message ?? "no data";
        const status = Number((error as { statusCode?: unknown; status?: unknown } | null)?.statusCode ?? (error as { status?: unknown } | null)?.status);
        if (/not.?found/i.test(m) || status === 400 || status === 404) throw new PermanentSourceError("Không tìm thấy tệp đã tải lên.");
        throw Object.assign(new Error(`Không tải được tệp (${m}).`), { retryable: true });
      }
      if (data.size > MAX_UPLOAD_BYTES) throw new PermanentSourceError("Tệp quá lớn (tối đa 12 MB).");
      const bytes = new Uint8Array(await data.arrayBuffer());
      const kind = kindByName ?? sniffTextKind(bytes, data.type);
      if (!kind) throw new PermanentSourceError("Chỉ nhận .txt, .md, .csv, .pdf, .docx, .xlsx hoặc .pptx.");
      return { text: await textFromBytes(kind, bytes), title: null };
    }
    // url: the Drive grant is for sources a signed-in person added (created_by set), not for API keys, as on the web.
    const url = (src.source_url ?? src.content).trim();
    try {
      const doc = await fetchUrlDoc({ db: this.db, options: this.options }, url, src.created_by ? src.workspace_id : undefined);
      // The title was defaulted from the link by knowledge_enqueue_source: the page's own title is better (the web did the same).
      // (The drawer sends the link without its scheme as the title; the RPC defaults to the same. A Drive folder file arrives with its own name.)
      const bare = (s: string) => s.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").slice(0, 160).toLowerCase();
      const defaulted = !src.title.trim() || bare(src.title) === bare(url);
      return { text: doc.text, title: defaulted && doc.title ? doc.title.slice(0, 160) : null };
    } catch (e) {
      if (/CHANNEL_TOKEN_KEY/.test(msg(e))) throw new PermanentSourceError("Máy chủ NIVO chưa được cấu hình để đọc Google Drive riêng tư.");
      throw e;
    }
  }

  /**
   * indexRow of the web: chunk, embed (metered), store passages with their embedding_model, write the note. Differences: progress, a retry
   * re-uses passages already embedded with the current model (no second bill), and a bulk document with no credits stores its passages
   * without vectors (keyword search works) and stops as blocked_credits instead of becoming ready.
   */
  private async chunkAndEmbed(src: SourceRow): Promise<void> {
    const pieces = chunkText(src.content);
    if (pieces.length === 0) throw new PermanentSourceError("Không có nội dung để lập chỉ mục.");
    const model = this.options.embedding.model;
    const db = this.db;

    if (await this.alreadyEmbedded(src, pieces, model)) {
      await db.from("knowledge_chunks").update({ module: src.module, visibility: src.visibility }).eq("source_id", src.id).eq("workspace_id", src.workspace_id);
      await this.patch(src, { chunk_count: pieces.length, error: null, progress: 80 });
      await this.afterIndexed(src);
      return;
    }

    const noCredits = pieces.length > BULK_CHUNKS && (await blockedBy(db, src.workspace_id, "embedding", { bulk: true })) !== null;
    const vectors = noCredits ? null : await embedTexts(this.options.embedding, { db, workspaceId: src.workspace_id, module: "knowledge" }, pieces, {
      onBatch: (done, total) => this.progress(src, 25 + (55 * done) / total),
    });
    const del = await db.from("knowledge_chunks").delete().eq("source_id", src.id).eq("workspace_id", src.workspace_id);
    if (del.error) throw Object.assign(new Error(del.error.message), { retryable: true });
    const rows = pieces.map((content, ord) => ({
      workspace_id: src.workspace_id, source_id: src.id, module: src.module, visibility: src.visibility, ord, content,
      embedding: vectors ? toVector(vectors[ord] as Array<number>) : null, embedding_model: vectors ? model : null,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      const ins = await db.from("knowledge_chunks").insert(rows.slice(i, i + 50));
      if (ins.error) throw Object.assign(new Error(ins.error.message), { retryable: true });
    }
    if (noCredits) {
      await this.patch(src, { status: "blocked_credits", error: NO_CREDITS_INDEX, chunk_count: pieces.length, progress: 80 });
      await this.syncAgents(src.workspace_id);
      throw new BlockedCreditsError("no credits for a bulk embedding");
    }
    const note = vectors ? null : "Chưa tạo được vector ngữ nghĩa; vẫn tìm được theo từ khóa.";
    await this.patch(src, { error: note, chunk_count: pieces.length, progress: 80 });
    await this.afterIndexed(src);
  }

  /** The stored passages are exactly these pieces, all embedded with `model` (a retried or re-queued source keeps its vectors). */
  private async alreadyEmbedded(src: SourceRow, pieces: ReadonlyArray<string>, model: string): Promise<boolean> {
    if (!this.options.embedding.apiKey) return false;
    const { data, error } = await this.db.from("knowledge_chunks").select("ord, content, embedding_model").eq("source_id", src.id).eq("workspace_id", src.workspace_id).not("embedding", "is", null).order("ord");
    if (error) return false;
    const have = (data ?? []) as Array<{ ord: number; content: string; embedding_model: string | null }>;
    return have.length === pieces.length && have.every((c, i) => c.ord === i && c.content === pieces[i] && c.embedding_model === model);
  }

  /** What the web did once a document was ready: answer knowledge gaps it covers, resync the agents. Best effort. */
  private async afterIndexed(src: SourceRow): Promise<void> {
    await resolveGapsForDocument(this.db, src.workspace_id, src);
    await this.syncAgents(src.workspace_id);
  }

  /* ------------------------------------------------------------------ knowledge.facts */

  async facts(job: JobContext<"knowledge.facts">): Promise<void> {
    const { sourceId, workspaceId } = payloadOf(job);
    const src = await this.load(sourceId, workspaceId);
    if (!src) return;
    // Only the stage it belongs to: ready = done already; anything else = the source was re-queued and its new index run enqueues a new facts job.
    if (src.status !== "extracting_facts") return;
    const done = async (note?: string) => {
      await this.patch(src, { status: "ready", progress: 100, ...(note ? { error: note } : {}) });
    };
    try {
      await extractDocument({
        db: this.db,
        generate: (ws, system, prompt) => this.model.generate(ws, system, prompt),
        onWindow: (n, total) => this.progress(src, 85 + (14 * n) / Math.max(1, total)),
      }, workspaceId, src);
      await done();
    } catch (e) {
      if (e instanceof FactsBlocked) {
        await this.patch(src, { status: "blocked_credits", error: NO_CREDITS_FACTS });
        throw new BlockedCreditsError("no credits for brain work");
      }
      const retry = e instanceof FactsRetry || isRetryable(e);
      if (retry && !isLastAttempt(job)) throw e instanceof Error ? e : new Error(msg(e));
      // The document is indexed and searchable: it becomes ready; only its fact reading is marked failed (Second Brain shows it).
      this.log.error(`knowledge.facts ${sourceId}: giving up: ${msg(e)}`);
      await markExtractionFailed(this.db, sourceId, msg(e));
      await done("Đã lưu tài liệu, nhưng NIVO chưa đọc được các sự thật trong đó. Thử lại sau.");
    }
  }

  /* ------------------------------------------------------------------ knowledge.reembed */

  /** reembedStale of the web (src/lib/knowledge/reembed.ts): chunks of another model (or none) get vectors of the current model, metered, credits first. */
  async reembed(job: JobContext<"knowledge.reembed">): Promise<void> {
    const d = (job.payload ?? {}) as Record<string, unknown>;
    const ws = d.workspaceId;
    if (typeof ws !== "string" || !UUID.test(ws)) throw new PermanentJobError("knowledge.reembed: payload needs workspaceId (uuid)");
    const settings = this.options.embedding;
    if (!settings.apiKey) return;
    const model = settings.model;
    if (typeof d.model === "string" && d.model && d.model !== model) {
      throw new PermanentJobError(`knowledge.reembed: asked for ${d.model} but the engine embeds with ${model}`);
    }
    const stale = `embedding_model.is.null,embedding.is.null,embedding_model.neq."${model.replace(/"/g, "")}"`;
    let embedded = 0;
    for (let b = 0; b < REEMBED_MAX_BATCHES; b++) {
      if (await blockedBy(this.db, ws, "embedding", { bulk: true })) {
        this.log.log(`knowledge.reembed ${ws}: no credits, ${embedded} embedded; the rest waits`);
        return;
      }
      const { data, error } = await this.db.from("knowledge_chunks").select("id, content").eq("workspace_id", ws).or(stale).order("created_at").limit(REEMBED_BATCH);
      if (error) throw new Error(error.message);
      const chunks = (data ?? []) as Array<{ id: string; content: string }>;
      if (chunks.length === 0) return;
      const vectors = await embedTexts(settings, { db: this.db, workspaceId: ws, module: "knowledge" }, chunks.map((c) => c.content), { timeoutMs: 30_000 });
      if (!vectors) throw new Error("embedding provider unavailable"); // the queue backoff replaces the web's 5-minute pause
      for (let i = 0; i < chunks.length; i += 8) {
        await Promise.all(chunks.slice(i, i + 8).map(async (c, j) => {
          const { error: e } = await this.db.from("knowledge_chunks").update({ embedding: toVector(vectors[i + j] as Array<number>), embedding_model: model }).eq("id", c.id).eq("workspace_id", ws);
          if (e) throw new Error(e.message);
        }));
      }
      embedded += chunks.length;
      if (chunks.length < REEMBED_BATCH) return;
    }
    // Still more: hand over to a follow-up job so one job never holds a worker for too long.
    await this.enqueue(ws, "knowledge.reembed", { workspaceId: ws, model }, `knowledge.reembed:${ws}:${job.id}:next`);
  }
}
