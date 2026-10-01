import { BeforeApplicationShutdown, Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { JobQueueService } from "./job-queue.service";
import { JOB_HANDLERS, PermanentJobError, QUEUE_OPTIONS, RetryJobError, type EngineJob, type JobHandler } from "./queue.types";
import type { QueueOptions } from "./queue.config";

type Running = { readonly job: EngineJob; readonly abort: AbortController; readonly done: Promise<void> };

export type WorkerSnapshot = { readonly workerId: string; readonly inflight: number; readonly lastPollOk: boolean; readonly lastPollAt: string | null; readonly stopping: boolean };

/**
 * The worker loop: claim due jobs (`for update skip locked` in SQL), run each handler with a heartbeat that keeps its lease alive,
 * report the outcome (complete / retry with backoff / fail), and publish this worker presence for the app status card.
 * Shutdown is graceful: stop claiming, let running jobs finish within the grace period, hand back whatever is left (attempt not counted).
 */
@Injectable()
export class WorkerService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly log = new Logger(WorkerService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly running = new Map<string, Running>();
  private pollTimer: NodeJS.Timeout | null = null;
  private presenceTimer: NodeJS.Timeout | null = null;
  private stopping = false;
  private polling = false;
  private lastPollOk = false;
  private lastPollAt: string | null = null;

  constructor(
    private readonly queue: JobQueueService,
    @Inject(QUEUE_OPTIONS) private readonly options: QueueOptions,
    @Inject(JOB_HANDLERS) handlers: ReadonlyArray<JobHandler>,
  ) {
    for (const handler of handlers) this.handlers.set(handler.kind, handler);
  }

  snapshot(): WorkerSnapshot {
    return { workerId: this.options.workerId, inflight: this.running.size, lastPollOk: this.lastPollOk, lastPollAt: this.lastPollAt, stopping: this.stopping };
  }

  onApplicationBootstrap(): void {
    this.log.log(`worker ${this.options.workerId} up; kinds: ${[...this.handlers.keys()].join(", ")}`);
    void this.presence();
    this.presenceTimer = setInterval(() => void this.presence(), 10_000);
    this.pollTimer = setInterval(() => void this.poll(), this.options.pollMs);
    void this.poll();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.log.log(`shutting down: waiting up to ${this.options.shutdownGraceMs}ms for ${this.running.size} job(s)`);
    const all = Promise.allSettled([...this.running.values()].map((r) => r.done));
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([all, new Promise((resolve) => { timer = setTimeout(resolve, this.options.shutdownGraceMs); })]);
    clearTimeout(timer);
    for (const { job, abort } of [...this.running.values()]) {
      abort.abort(new Error("worker shutting down"));
      await this.queue.release(job.id, this.options.workerId).catch(() => false);
      this.log.warn(`job ${job.id} handed back to the queue`);
    }
    if (this.presenceTimer) clearInterval(this.presenceTimer);
  }

  private async presence(): Promise<void> {
    try {
      await this.queue.workerHeartbeat(this.options.workerId, this.options.version, [...this.handlers.keys()], { inflight: this.running.size, stopping: this.stopping });
    } catch (e) {
      this.log.warn(`worker heartbeat failed: ${(e as Error).message}`);
    }
  }

  private async poll(): Promise<void> {
    if (this.polling || this.stopping) return;
    const free = this.options.concurrency - this.running.size;
    if (free <= 0) return;
    this.polling = true;
    try {
      const jobs = await this.queue.claim(this.options.workerId, [...this.handlers.keys()], free, this.options.leaseSeconds);
      this.lastPollOk = true;
      for (const job of jobs) this.start(job);
    } catch (e) {
      this.lastPollOk = false;
      this.log.warn(`claim failed: ${(e as Error).message}`);
    } finally {
      this.lastPollAt = new Date().toISOString();
      this.polling = false;
    }
  }

  private start(job: EngineJob): void {
    const abort = new AbortController();
    const done = this.execute(job, abort).finally(() => this.running.delete(job.id));
    this.running.set(job.id, { job, abort, done });
  }

  private async execute(job: EngineJob, abort: AbortController): Promise<void> {
    const worker = this.options.workerId;
    const handler = this.handlers.get(job.kind);
    const beat = setInterval(() => {
      this.queue.heartbeat(job.id, worker, this.options.leaseSeconds).then(
        (ours) => { if (!ours) abort.abort(new Error("lease lost")); },
        (e: Error) => this.log.warn(`lease heartbeat for ${job.id} failed: ${e.message}`),
      );
    }, (this.options.leaseSeconds * 1000) / 3);
    try {
      if (!handler) throw new PermanentJobError(`no handler for kind ${job.kind}`);
      this.log.log(`job ${job.id} ${job.kind} attempt ${job.attempts}/${job.max_attempts}`);
      const result = await handler.run(job, abort.signal);
      if (abort.signal.aborted) return; // the lease was lost or we are shutting down: the queue owns the job again
      await this.queue.complete(job.id, worker, result);
    } catch (e) {
      if (abort.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      const outcome = await this.queue
        .fail(job.id, worker, message, { permanent: e instanceof PermanentJobError, retryAfterSeconds: e instanceof RetryJobError ? e.seconds : undefined })
        .catch((err: Error) => `fail-error: ${err.message}`);
      this.log.warn(`job ${job.id} ${job.kind} failed (${outcome}): ${message}`);
    } finally {
      clearInterval(beat);
    }
  }
}
