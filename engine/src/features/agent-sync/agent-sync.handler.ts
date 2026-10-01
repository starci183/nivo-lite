import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NivoHttpError } from "../../platform/nivo/nivo-client.service";
import { OPENCLAW_OPTIONS, type OpenclawOptions } from "../../platform/openclaw/openclaw.config";
import { PermanentJobError, RetryJobError, type EngineJob, type JobHandler, type JobResult } from "../../platform/queue/queue.types";
import { SUPABASE } from "../../platform/supabase/supabase.module";
import { AgentSyncService } from "./agent-sync.service";

/**
 * openclaw.sync_agent { installation_id }: rebuild one agent's OpenClaw copy (AGENTS.md, SOUL.md, knowledge/*.md, the openclaw.json entry) from Supabase.
 * Enqueued by the app (setup applied, knowledge changed, processor switched, the button), by pg_cron every 5 minutes for every installation on
 * OpenClaw, and by this engine at startup so a fresh VPS rebuilds everything from Supabase. Safe to run twice: an unchanged copy only moves checked_at.
 */
@Injectable()
export class AgentSyncHandler implements JobHandler, OnApplicationBootstrap {
  readonly kind = "openclaw.sync_agent";
  private readonly log = new Logger(AgentSyncHandler.name);

  constructor(
    private readonly sync: AgentSyncService,
    @Inject(SUPABASE) private readonly db: SupabaseClient,
    @Inject(OPENCLAW_OPTIONS) private readonly openclaw: OpenclawOptions,
  ) {}

  /** Startup: queue a sync for every installation on OpenClaw (collapsed in SQL against ones already waiting). */
  onApplicationBootstrap(): void {
    if (!this.openclaw.gateway || !this.openclaw.manageAgents) return;
    setTimeout(() => {
      void this.db.rpc("engine_schedule_agent_sync").then(({ data, error }) => {
        if (error) this.log.warn(`startup sync enqueue failed: ${error.message}`);
        else this.log.log(`startup: sync queued for ${String(data)} installation(s) on OpenClaw`);
      });
    }, 3000);
  }

  async run(job: EngineJob, signal: AbortSignal): Promise<JobResult> {
    if (!job.workspace_id || typeof job.payload.installation_id !== "string") throw new PermanentJobError("openclaw.sync_agent needs a workspace and an installation_id");
    try {
      return { ...(await this.sync.sync(job, signal)) };
    } catch (e) {
      if (e instanceof NivoHttpError) throw e.permanent ? new PermanentJobError(e.message) : new RetryJobError(e.message, 20);
      throw e;
    }
  }
}
