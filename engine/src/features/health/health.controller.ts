import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { OPENCLAW_VERSION_NOTE } from "./health.constants";
import { JobRegistry } from "../../platform/pgmq/job-registry.service";
import { GatewayClient } from "../../platform/openclaw/gateway.client";
import { WorkerService } from "../../platform/queue/worker.service";

/**
 * /healthz is liveness: the process is up and its loops exist. It never waits on Supabase or OpenClaw (the queue depth, ages and the
 * failed count come from job_stats, cached every 10 s), so an outage there does not make the orchestrator restart a healthy process.
 * The watchdog reads `jobs.stats.oldestQueuedAgeSeconds` and `jobs.stats.failed24h` from it.
 * /readyz is readiness: the last engine_jobs poll reached the database (when that worker is on) and pgmq answered (job_stats, job_read).
 */
@Controller()
export class HealthController {
  private readonly startedAt = new Date().toISOString();

  constructor(
    private readonly worker: WorkerService,
    private readonly gateway: GatewayClient,
    private readonly jobs: JobRegistry,
  ) {}

  @Get("healthz")
  healthz() {
    return {
      status: "ok",
      startedAt: this.startedAt,
      worker: this.worker.snapshot(),
      openclaw: this.gateway.enabled ? "configured" : "not_configured",
      note: OPENCLAW_VERSION_NOTE,
      jobs: { ...this.jobs.snapshot(), stats: this.jobs.cachedStats() },
    };
  }

  @Get("readyz")
  readyz() {
    const snapshot = this.worker.snapshot();
    const jobs = { ...this.jobs.snapshot(), pgmq: this.jobs.ready() ? "ok" : "unreachable" };
    const body = { worker: snapshot, jobs };
    const workerOk = !snapshot.enabled || snapshot.lastPollOk;
    if (!workerOk || snapshot.stopping || !this.jobs.ready()) throw new HttpException({ status: "not_ready", ...body }, HttpStatus.SERVICE_UNAVAILABLE);
    return { status: "ready", ...body };
  }
}
