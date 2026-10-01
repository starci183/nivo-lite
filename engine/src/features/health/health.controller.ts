import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { OPENCLAW_VERSION_NOTE } from "./health.constants";
import { GatewayClient } from "../../platform/openclaw/gateway.client";
import { WorkerService } from "../../platform/queue/worker.service";

/**
 * /healthz is liveness: the process is up and its loop exists. It never depends on Supabase or OpenClaw, so an outage there does not
 * make the orchestrator restart a healthy process. /readyz is readiness: the last queue poll reached the database.
 */
@Controller()
export class HealthController {
  private readonly startedAt = new Date().toISOString();

  constructor(private readonly worker: WorkerService, private readonly gateway: GatewayClient) {}

  @Get("healthz")
  healthz() {
    return { status: "ok", startedAt: this.startedAt, worker: this.worker.snapshot(), openclaw: this.gateway.enabled ? "configured" : "not_configured", note: OPENCLAW_VERSION_NOTE };
  }

  @Get("readyz")
  readyz() {
    const snapshot = this.worker.snapshot();
    if (!snapshot.lastPollOk || snapshot.stopping) throw new HttpException({ status: "not_ready", worker: snapshot }, HttpStatus.SERVICE_UNAVAILABLE);
    return { status: "ready", worker: snapshot };
  }
}
