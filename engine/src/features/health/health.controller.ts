import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { OPENCLAW_VERSION_NOTE } from "./health.constants";
import { JobRegistry } from "../../platform/bullmq/job-registry.service";
import { OutboxRelayService } from "../../platform/bullmq/outbox-relay.service";
import { RedisConnection } from "../../platform/bullmq/redis.connection";
import { GatewayClient } from "../../platform/openclaw/gateway.client";
import { WorkerService } from "../../platform/queue/worker.service";

/**
 * /healthz is liveness: the process is up and its loops exist. It never waits on Supabase, Redis or OpenClaw (the outbox lag and the failed
 * job count are cached by the relay), so an outage there does not make the orchestrator restart a healthy process. The watchdog reads
 * `outbox.oldestUnrelayedAgeSeconds` and `jobs.failed` from it.
 * /readyz is readiness: the last engine_jobs poll reached the database and, when REDIS_URL is set, Redis answers a PING.
 */
@Controller()
export class HealthController {
  private readonly startedAt = new Date().toISOString();

  constructor(
    private readonly worker: WorkerService,
    private readonly gateway: GatewayClient,
    private readonly redis: RedisConnection,
    private readonly jobs: JobRegistry,
    private readonly relay: OutboxRelayService,
  ) {}

  @Get("healthz")
  healthz() {
    const stats = this.relay.stats();
    return {
      status: "ok",
      startedAt: this.startedAt,
      worker: this.worker.snapshot(),
      openclaw: this.gateway.enabled ? "configured" : "not_configured",
      note: OPENCLAW_VERSION_NOTE,
      outbox: stats.outbox,
      jobs: { ...stats.jobs, ...this.jobs.snapshot(), relay: this.relay.snapshot() },
    };
  }

  @Get("readyz")
  async readyz() {
    const snapshot = this.worker.snapshot();
    const redis = await this.redis.health();
    const redisOk = !redis.configured || redis.ok;
    const body = { worker: snapshot, redis, jobs: this.jobs.snapshot(), relay: this.relay.snapshot() };
    if (!snapshot.lastPollOk || snapshot.stopping || !redisOk) throw new HttpException({ status: "not_ready", ...body }, HttpStatus.SERVICE_UNAVAILABLE);
    return { status: "ready", ...body };
  }
}
