import { BeforeApplicationShutdown, Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE } from "../supabase/supabase.module";
import { JOB_QUEUE, isJobName, type JobName } from "./contracts";
import { JOBS_OPTIONS, type JobsOptions } from "./jobs.config";
import { ATTEMPTS, BACKOFF_MS, isUnrecoverable, type JobContext, type JobHandler } from "./jobs.types";

/** One message as job_read returns it. */
type ReadRow = { readonly msg_id: number; readonly attempt: number; readonly enqueued_at: string; readonly message: { name?: unknown; payload?: unknown; dedupe?: unknown } | null };

/** job_stats(): what /healthz shows and the watchdog alerts on. */
export type JobsStats = {
  readonly queues: Readonly<Record<string, { readonly depth: number; readonly oldestAgeSeconds: number; readonly total: number }>>;
  readonly running: number;
  readonly failed24h: number;
  readonly oldestQueuedAgeSeconds: number;
  readonly checkedAt: string | null;
};

export type JobsSnapshot = {
  readonly enabled: boolean; readonly handlers: ReadonlyArray<string>; readonly queues: ReadonlyArray<string>; readonly active: number; readonly stopping: boolean;
  readonly lastReadAt: string | null; readonly lastReadOk: boolean; readonly lastError: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATS_MS = 10_000;
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * The consuming side of the pgmq queues (docs/JOBS.md). Feature modules register one handler per job name (in their onModuleInit); at
 * bootstrap one poll loop starts for the queues that have handlers. Each pass reads at most the free slots (JOBS_CONCURRENCY) with
 * job_read, which also enforces JOBS_WORKSPACE_CONCURRENCY across engines; a running handler keeps its message invisible with job_touch;
 * the end is job_ack (done), job_fail (retry after 5 s, 10 s, 20 s) or job_archive (attempts used up or an unrecoverable error).
 * Shutdown stops reading, gives running jobs ENGINE_SHUTDOWN_GRACE_MS, then aborts them and hands their messages back (visible at once).
 */
@Injectable()
export class JobRegistry implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly log = new Logger("jobs");
  private readonly handlers = new Map<JobName, JobHandler>();
  private readonly running = new Map<string, { abort: AbortController; done: Promise<void> }>();
  private stopping = false;
  private loop: Promise<void> | null = null;
  private wake: (() => void) | null = null;
  private lastReadAt: string | null = null;
  private lastReadOk = false;
  private lastError: string | null = null;
  private stats: JobsStats = { queues: {}, running: 0, failed24h: 0, oldestQueuedAgeSeconds: 0, checkedAt: null };
  private statsOk = false;
  private statsTimer: NodeJS.Timeout | null = null;

  constructor(@Inject(SUPABASE) private readonly db: SupabaseClient, @Inject(JOBS_OPTIONS) private readonly options: JobsOptions) {}

  /** Registers the handler of a job name; a second handler for the same name is a wiring bug. */
  register<N extends JobName>(handler: JobHandler<N>): void {
    if (this.handlers.has(handler.name)) throw new Error(`job ${handler.name} already has a handler`);
    this.handlers.set(handler.name, handler as unknown as JobHandler);
  }

  private queues(): ReadonlyArray<string> {
    return [...new Set([...this.handlers.keys()].map((n) => JOB_QUEUE[n]))];
  }

  snapshot(): JobsSnapshot {
    return {
      enabled: this.options.enabled, handlers: [...this.handlers.keys()], queues: this.queues(), active: this.running.size, stopping: this.stopping,
      lastReadAt: this.lastReadAt, lastReadOk: this.lastReadOk, lastError: this.lastError,
    };
  }

  /** Cached job_stats (refreshed every 10 s), so /healthz never waits on the database. */
  cachedStats(): JobsStats {
    return this.stats;
  }

  /** Readiness: pgmq answered (job_stats) within the last refresh, and, when the consumer is on, the last read worked. */
  ready(): boolean {
    return this.statsOk && (!this.options.enabled || this.handlers.size === 0 || this.lastReadOk);
  }

  private async refreshStats(): Promise<void> {
    const { data, error } = await this.db.rpc("job_stats");
    if (error || !data) {
      this.statsOk = false;
      return;
    }
    this.stats = data as JobsStats;
    this.statsOk = true;
  }

  onApplicationBootstrap(): void {
    void this.refreshStats().catch(() => undefined);
    this.statsTimer = setInterval(() => void this.refreshStats().catch(() => undefined), STATS_MS);
    const names = [...this.handlers.keys()].join(", ") || "none";
    if (!this.options.enabled) {
      this.log.warn(`JOBS_ENABLED=0: the pgmq consumer is off (handlers registered: ${names}); jobs wait in their queue`);
      return;
    }
    if (this.handlers.size === 0) return;
    this.log.log(`pgmq consumer up: queues ${this.queues().join(", ")}; jobs ${names}; concurrency ${this.options.concurrency}, per workspace ${this.options.workspaceConcurrency}, vt ${this.options.visibilitySeconds}s`);
    this.loop = this.run();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.wake?.();
    await this.loop;
    if (this.running.size === 0) return;
    this.log.log(`shutting down: ${this.running.size} job(s) running, grace ${this.options.shutdownGraceMs}ms`);
    let timer: NodeJS.Timeout | undefined;
    const all = Promise.allSettled([...this.running.values()].map((r) => r.done));
    await Promise.race([all, new Promise((resolve) => { timer = setTimeout(resolve, this.options.shutdownGraceMs); })]);
    clearTimeout(timer);
    if (this.running.size > 0) {
      this.log.warn(`aborting ${this.running.size} job(s); their messages are handed back`);
      for (const r of this.running.values()) r.abort.abort(new Error("worker shutting down"));
      await Promise.allSettled([...this.running.values()].map((r) => r.done));
    }
  }

  private async run(): Promise<void> {
    let failures = 0;
    while (!this.stopping) {
      let started = 0;
      try {
        for (const queue of this.queues()) {
          const free = this.options.concurrency - this.running.size;
          if (free <= 0 || this.stopping) break;
          started += await this.readOnce(queue, free);
        }
        failures = 0;
        this.lastReadOk = true;
        this.lastError = null;
      } catch (e) {
        failures++;
        this.lastReadOk = false;
        this.lastError = msg(e);
        if (failures === 1 || failures % 30 === 0) this.log.warn(`job_read failed (${failures}x): ${this.lastError}`);
      } finally {
        this.lastReadAt = new Date().toISOString();
      }
      if (this.stopping) break;
      if (started > 0 && this.running.size < this.options.concurrency) continue;
      // Wait for the poll interval or a finished job; back off up to 15 s while the database is unreachable.
      await this.sleep(failures ? Math.min(15_000, this.options.pollMs * 2 ** Math.min(failures, 4)) : this.options.pollMs);
    }
  }

  /** One job_read on a queue; starts what came back. Returns how many started. */
  private async readOnce(queue: string, free: number): Promise<number> {
    const { data, error } = await this.db.rpc("job_read", {
      p_queue: queue, p_vt: this.options.visibilitySeconds, p_qty: free, p_ws_limit: this.options.workspaceConcurrency,
    });
    if (error) throw new Error(`job_read: ${error.message}`);
    const rows = (data ?? []) as ReadonlyArray<ReadRow>;
    for (const row of rows) this.start(queue, row);
    return rows.length;
  }

  private start(queue: string, row: ReadRow): void {
    const key = `${queue}:${row.msg_id}`;
    const abort = new AbortController();
    const done = this.process(queue, row, abort)
      .catch((e: unknown) => this.log.error(`job ${key}: ${msg(e)}`))
      .finally(() => {
        this.running.delete(key);
        this.wake?.();
      });
    this.running.set(key, { abort, done });
  }

  private async process(queue: string, row: ReadRow, abort: AbortController): Promise<void> {
    const m = row.message ?? {};
    const name = typeof m.name === "string" ? m.name : "";
    const handler = isJobName(name) ? this.handlers.get(name) : undefined;
    const payload = (m.payload ?? {}) as { workspaceId?: unknown };
    const workspaceId = typeof payload.workspaceId === "string" && UUID.test(payload.workspaceId) ? payload.workspaceId : null;
    const id = typeof m.dedupe === "string" ? m.dedupe : `${queue}:${row.msg_id}`;
    if (!handler || !workspaceId) {
      const reason = !handler ? `no handler for job ${name || "(unnamed)"}` : `job ${name} ${id}: payload.workspaceId is missing or not a uuid`;
      this.log.warn(reason);
      await this.rpc("job_archive", { p_queue: queue, p_msg_id: row.msg_id, p_error: reason });
      return;
    }
    const attempt = Math.max(1, row.attempt);
    const ctx: JobContext = {
      id, name: name as JobName, payload: payload as JobContext["payload"], workspaceId, attempt, maxAttempts: ATTEMPTS,
      isFinalAttempt: attempt >= ATTEMPTS, signal: abort.signal,
    };
    // Keep the message invisible (and the workspace slot leased) while the handler runs.
    const vt = this.options.visibilitySeconds;
    const touch = setInterval(() => void this.rpc("job_touch", { p_queue: queue, p_msg_id: row.msg_id, p_vt: vt }).catch(() => undefined), (vt * 1000) / 3);
    const t0 = Date.now();
    try {
      if (attempt > ATTEMPTS) throw Object.assign(new Error(`gave up after ${ATTEMPTS} attempts`), { final: true });
      await handler.handle(ctx);
      clearInterval(touch);
      await this.rpc("job_ack", { p_queue: queue, p_msg_id: row.msg_id });
      this.log.log(`job ${name} ${id} done in ${Date.now() - t0}ms (attempt ${attempt}/${ATTEMPTS})`);
    } catch (e) {
      clearInterval(touch);
      const error = e instanceof Error ? e : new Error(String(e));
      if (abort.signal.aborted) {
        // Shutdown: hand it back at once; nothing is final yet.
        await this.rpc("job_fail", { p_queue: queue, p_msg_id: row.msg_id, p_delay_s: 0, p_error: "worker shutting down" }).catch(() => undefined);
        return;
      }
      if (isUnrecoverable(error) || ctx.isFinalAttempt || (error as { final?: boolean }).final) {
        this.log.warn(`job ${name} ${id} failed for good (attempt ${attempt}/${ATTEMPTS}): ${error.message}`);
        if (handler.onFailed) await handler.onFailed(ctx, error).catch((x: unknown) => this.log.warn(`onFailed of ${name} ${id} threw: ${msg(x)}`));
        await this.rpc("job_archive", { p_queue: queue, p_msg_id: row.msg_id, p_error: error.message });
        return;
      }
      const delayS = Math.round((BACKOFF_MS * 2 ** (attempt - 1)) / 1000);
      this.log.warn(`job ${name} ${id} attempt ${attempt}/${ATTEMPTS} failed, retry in ${delayS}s: ${error.message}`);
      await this.rpc("job_fail", { p_queue: queue, p_msg_id: row.msg_id, p_delay_s: delayS, p_error: error.message });
    } finally {
      clearInterval(touch);
    }
  }

  private async rpc(fn: string, args: Record<string, unknown>): Promise<void> {
    const { error } = await this.db.rpc(fn, args);
    // A lost ack/fail is safe: the visibility timeout re-delivers the message and the handlers are idempotent.
    if (error) throw new Error(`${fn}: ${error.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.wake = null; resolve(); }, ms);
      this.wake = () => { clearTimeout(timer); this.wake = null; resolve(); };
    });
  }
}
