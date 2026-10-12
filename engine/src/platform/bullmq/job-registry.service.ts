import { BeforeApplicationShutdown, Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { DelayedError, UnrecoverableError, Worker, type Job } from "bullmq";
import { BULLMQ_OPTIONS, type BullmqOptions } from "./bullmq.config";
import { LOCK_DURATION_MS, WORKSPACE_BUSY_DELAY_MS, WORKSPACE_SLOT_LEASE_MS } from "./bullmq.policy";
import type { BullJobHandler, JobContext } from "./bullmq.types";
import { isUnrecoverable } from "./bullmq.types";
import { JOB_QUEUE, type JobName } from "./contracts";
import { RedisConnection } from "./redis.connection";
import { WorkspaceSemaphore } from "./workspace-semaphore";

export type JobsSnapshot = { readonly enabled: boolean; readonly handlers: ReadonlyArray<string>; readonly queues: ReadonlyArray<string>; readonly active: number; readonly stopping: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The consuming side: feature modules register one handler per job name (in their onModuleInit), and at bootstrap one BullMQ Worker per
 * queue that has handlers starts with JOBS_CONCURRENCY. Every delivery first takes one of its workspace's slots (WorkspaceSemaphore); a
 * workspace at its limit sends the job back to delayed for a few seconds without spending an attempt. Shutdown stops taking jobs, gives the
 * running ones ENGINE_SHUTDOWN_GRACE_MS, then aborts them (BullMQ re-delivers them after their lock expires).
 */
@Injectable()
export class JobRegistry implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly log = new Logger("jobs");
  private readonly handlers = new Map<JobName, BullJobHandler>();
  private readonly workers: Array<Worker> = [];
  private readonly running = new Map<string, AbortController>();
  private stopping = false;

  constructor(
    @Inject(BULLMQ_OPTIONS) private readonly options: BullmqOptions,
    private readonly redis: RedisConnection,
    private readonly slots: WorkspaceSemaphore,
  ) {}

  /** Registers the handler of a job name; a second handler for the same name is a wiring bug. */
  register<N extends JobName>(handler: BullJobHandler<N>): void {
    if (this.handlers.has(handler.name)) throw new Error(`job ${handler.name} already has a handler`);
    this.handlers.set(handler.name, handler as unknown as BullJobHandler);
  }

  snapshot(): JobsSnapshot {
    return { enabled: this.redis.client !== null, handlers: [...this.handlers.keys()], queues: this.workers.map((w) => w.name), active: this.running.size, stopping: this.stopping };
  }

  onApplicationBootstrap(): void {
    const client = this.redis.client;
    if (!client) {
      this.log.warn(`REDIS_URL not set: BullMQ workers are off (handlers registered: ${[...this.handlers.keys()].join(", ") || "none"})`);
      return;
    }
    const queues = [...new Set([...this.handlers.keys()].map((n) => JOB_QUEUE[n]))];
    for (const queue of queues) {
      const worker = new Worker(queue, (job, token, signal) => this.process(job, token, signal), {
        connection: client,
        prefix: this.options.prefix,
        concurrency: this.options.concurrency,
        lockDuration: LOCK_DURATION_MS,
        maxStalledCount: 2,
      });
      worker.on("failed", (job, err) => {
        if (job && !(err instanceof DelayedError)) this.log.warn(`job ${job.name} ${job.id} attempt ${job.attemptsMade}/${job.opts.attempts ?? 1} failed: ${err.message}`);
      });
      worker.on("error", (err) => this.log.warn(`worker ${queue}: ${err.message}`));
      this.workers.push(worker);
    }
    this.log.log(`BullMQ workers up: queues ${queues.join(", ") || "none"}; jobs ${[...this.handlers.keys()].join(", ") || "none"}; concurrency ${this.options.concurrency}, per workspace ${this.options.workspaceConcurrency}`);
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.workers.length === 0) return;
    this.log.log(`shutting down: ${this.running.size} job(s) running, grace ${this.options.shutdownGraceMs}ms`);
    let timer: NodeJS.Timeout | undefined;
    const graceful = Promise.allSettled(this.workers.map((w) => w.close()));
    await Promise.race([graceful, new Promise((resolve) => { timer = setTimeout(resolve, this.options.shutdownGraceMs); })]);
    clearTimeout(timer);
    if (this.running.size > 0) {
      this.log.warn(`aborting ${this.running.size} job(s); BullMQ re-delivers them`);
      for (const abort of this.running.values()) abort.abort(new Error("worker shutting down"));
      await Promise.allSettled(this.workers.map((w) => w.close(true)));
    }
  }

  private async process(job: Job, token: string | undefined, signal: AbortSignal | undefined): Promise<void> {
    const name = job.name as JobName;
    const handler = this.handlers.get(name);
    if (!handler) throw new UnrecoverableError(`no handler for job ${job.name}`);
    const payload = (job.data ?? {}) as { workspaceId?: unknown };
    const workspaceId = typeof payload.workspaceId === "string" && UUID.test(payload.workspaceId) ? payload.workspaceId : null;
    if (!workspaceId) throw new UnrecoverableError(`job ${job.name} ${job.id}: payload.workspaceId is missing or not a uuid`);
    const jobId = job.id ?? `${job.name}-${Date.now()}`;

    if (!(await this.slots.acquire(workspaceId, jobId))) {
      // The workspace already runs its share: back to delayed (no attempt spent), so other workspaces' jobs take this worker slot.
      await job.moveToDelayed(Date.now() + WORKSPACE_BUSY_DELAY_MS + Math.floor(Math.random() * 1_000), token);
      throw new DelayedError();
    }

    const abort = new AbortController();
    const onOuterAbort = () => abort.abort(signal?.reason);
    signal?.addEventListener("abort", onOuterAbort, { once: true });
    this.running.set(jobId, abort);
    const renew = setInterval(() => void this.slots.renew(workspaceId, jobId).catch(() => undefined), WORKSPACE_SLOT_LEASE_MS / 3);
    const maxAttempts = job.opts.attempts ?? 1;
    const ctx: JobContext = {
      id: jobId,
      name,
      payload: job.data as JobContext["payload"],
      workspaceId,
      attempt: job.attemptsMade + 1,
      maxAttempts,
      isFinalAttempt: job.attemptsMade + 1 >= maxAttempts,
      signal: abort.signal,
      progress: (percent) => job.updateProgress(Math.max(0, Math.min(100, Math.round(percent)))),
    };
    const t0 = Date.now();
    try {
      await handler.handle(ctx);
      this.log.log(`job ${name} ${jobId} done in ${Date.now() - t0}ms (attempt ${ctx.attempt}/${maxAttempts})`);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      // Aborted by shutdown: BullMQ re-delivers it, so nothing is final yet.
      if (!abort.signal.aborted && (isUnrecoverable(error) || ctx.isFinalAttempt) && handler.onFailed) {
        await handler.onFailed(ctx, error).catch((err: Error) => this.log.warn(`onFailed of ${name} ${jobId} threw: ${err.message}`));
      }
      throw error;
    } finally {
      clearInterval(renew);
      signal?.removeEventListener("abort", onOuterAbort);
      this.running.delete(jobId);
      await this.slots.release(workspaceId, jobId).catch(() => undefined);
    }
  }
}
