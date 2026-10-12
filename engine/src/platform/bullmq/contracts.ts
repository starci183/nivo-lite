/**
 * Background job contracts: the ONE list of queues, job names and payloads shared by every producer (the web app, SQL RPCs) and the
 * worker (src/lib/jobs/contracts.ts in the web app holds an identical copy; keep both files byte-for-byte equal below this header).
 * Payloads carry ids, never rows: the handler re-reads the current state, so a retried or duplicated job sees the truth. See docs/JOBS.md.
 */

/** BullMQ queue names. One queue per bounded area; the job name says what to do inside it. */
export const QUEUES = {
  knowledge: "knowledge",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** knowledge.index: read the source (storage / link / text) -> extract -> chunk -> embed; on success enqueue knowledge.facts. */
export type KnowledgeIndexPayload = { readonly sourceId: string; readonly workspaceId: string };
/** knowledge.facts: read facts out of a ready source into brain_facts proposals (conflicts surfaced). Chained after knowledge.index. */
export type KnowledgeFactsPayload = { readonly sourceId: string; readonly workspaceId: string };
/** knowledge.reembed: re-embed the workspace's chunks made by another model than `model` (default: the model in use). */
export type KnowledgeReembedPayload = { readonly workspaceId: string; readonly model?: string };

/** Every job name -> its payload. Adding a job = one entry here (both copies) + JOB_QUEUE + a handler in the engine. */
export type JobPayloads = {
  readonly "knowledge.index": KnowledgeIndexPayload;
  readonly "knowledge.facts": KnowledgeFactsPayload;
  readonly "knowledge.reembed": KnowledgeReembedPayload;
};
export type JobName = keyof JobPayloads;

/** The queue each job runs on. */
export const JOB_QUEUE: { readonly [N in JobName]: QueueName } = {
  "knowledge.index": QUEUES.knowledge,
  "knowledge.facts": QUEUES.knowledge,
  "knowledge.reembed": QUEUES.knowledge,
};

export const JOB_NAMES = Object.keys(JOB_QUEUE) as ReadonlyArray<JobName>;

export const isJobName = (v: string): v is JobName => Object.prototype.hasOwnProperty.call(JOB_QUEUE, v);

/**
 * The dedupe key (= BullMQ jobId) of a job: `<name>:<subject>` plus an optional suffix for a deliberate re-run (`:retry:<ms>`).
 * The same key enqueued twice is one job. BullMQ forbids ':' only in custom ids that look like numbers, so these are safe.
 */
export const dedupeKey = (name: JobName, subject: string, suffix?: string): string => `${name}:${subject}${suffix ? `:${suffix}` : ""}`;

/** knowledge_sources.status, in lifecycle order (pending = written by the old synchronous path). */
export const SOURCE_STATUSES = ["pending", "queued", "reading", "indexing", "extracting_facts", "ready", "failed", "blocked_credits"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];
/** Statuses that mean work is still to come (the "Đang xử lý N tài liệu" count). */
export const OPEN_SOURCE_STATUSES: ReadonlyArray<SourceStatus> = ["queued", "reading", "indexing", "extracting_facts"];
/** Statuses the owner may retry (knowledge_retry_source). */
export const RETRYABLE_SOURCE_STATUSES: ReadonlyArray<SourceStatus> = ["failed", "blocked_credits"];

/** Storage of uploaded documents: bucket and object path '<workspaceId>/<uuid>/<filename>'. */
export const KNOWLEDGE_UPLOAD_BUCKET = "knowledge-uploads";
export const knowledgeUploadPath = (workspaceId: string, id: string, filename: string): string =>
  `${workspaceId}/${id}/${filename.replace(/^.*[\/]/, "").replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 160) || "file"}`;

/** Failure reason recorded when a workspace has no credits left: the job fails WITHOUT retrying (BullMQ UnrecoverableError). */
export const BLOCKED_CREDITS = "blocked_credits";
