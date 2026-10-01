import { Inject, Injectable, Logger } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PermanentJobError, type EngineJob, type JobHandler, type JobResult } from "../../platform/queue/queue.types";
import { SUPABASE } from "../../platform/supabase/supabase.module";

type ConnectionRow = {
  readonly id: string;
  readonly provider: string;
  readonly name: string;
  readonly status: string;
  readonly last_error: string | null;
  readonly last_event_at: string | null;
  readonly created_at: string;
  readonly public_meta: { health?: { state?: string } } | null;
};

type HealthState = "ok" | "silent" | "failing";

/** Providers that send us events. Zalo OA can only store settings for now (no inbound), so silence there means nothing. */
const RECEIVES_EVENTS = new Set(["telegram", "sepay", "payos", "casso"]);
const DEFAULT_SILENT_AFTER_HOURS = 72;

/**
 * connection.health: mark a workspace connections that are failing (status error) or have been silent for too long (no event for
 * `silentAfterHours`, default 72). The mark is `connections.public_meta.health = { state, reason, checked_at }`, written atomically by
 * engine_mark_connection_health and only when the state changes. It never changes a connection status: that stays the owner decision.
 * Scheduled every 15 minutes by pg_cron (engine_schedule_connection_health), which dedupes per workspace.
 */
@Injectable()
export class ConnectionHealthHandler implements JobHandler {
  readonly kind = "connection.health";
  private readonly log = new Logger(ConnectionHealthHandler.name);

  constructor(@Inject(SUPABASE) private readonly db: SupabaseClient) {}

  async run(job: EngineJob): Promise<JobResult> {
    if (!job.workspace_id) throw new PermanentJobError("connection.health needs a workspace");
    const silentAfterHours = typeof job.payload.silentAfterHours === "number" && job.payload.silentAfterHours > 0 ? job.payload.silentAfterHours : DEFAULT_SILENT_AFTER_HOURS;
    const { data, error } = await this.db
      .from("connections").select("id, provider, name, status, last_error, last_event_at, created_at, public_meta")
      .eq("workspace_id", job.workspace_id).neq("status", "disconnected");
    if (error) throw new Error(error.message);

    const now = Date.now();
    const counts = { checked: 0, ok: 0, silent: 0, failing: 0, changed: 0 };
    for (const c of (data ?? []) as ReadonlyArray<ConnectionRow>) {
      if (c.status === "pending") continue; // setup is not finished: nothing to judge yet
      counts.checked++;
      const { state, reason } = this.judge(c, now, silentAfterHours);
      counts[state]++;
      if (c.public_meta?.health?.state === state || (state === "ok" && c.public_meta?.health === undefined)) continue;
      const mark = await this.db.rpc("engine_mark_connection_health", { p_workspace: job.workspace_id, p_connection: c.id, p_health: { state, reason, checked_at: new Date().toISOString() } });
      if (mark.error) throw new Error(`engine_mark_connection_health: ${mark.error.message}`);
      counts.changed++;
      if (state !== "ok") await this.notifyOffice(job.workspace_id, c, state, reason);
    }
    return counts;
  }

  private judge(c: ConnectionRow, now: number, silentAfterHours: number): { state: HealthState; reason: string } {
    if (c.status === "error") return { state: "failing", reason: c.last_error?.slice(0, 200) || "connection reports an error" };
    if (RECEIVES_EVENTS.has(c.provider)) {
      const last = Date.parse(c.last_event_at ?? c.created_at);
      const hours = (now - last) / 3_600_000;
      if (hours > silentAfterHours) return { state: "silent", reason: `no event for ${Math.floor(hours)}h` };
    }
    return { state: "ok", reason: "" };
  }

  /**
   * TODO(office): post a line into Office (messages table, author NIVO) when a connection turns silent or failing, through an app
   * route so it follows the same evidence rules as every other Office message. Intentionally a no-op until that route exists.
   */
  private async notifyOffice(workspaceId: string, c: ConnectionRow, state: HealthState, reason: string): Promise<void> {
    this.log.log(`workspace ${workspaceId.slice(0, 8)}: connection ${c.provider}/${c.name} is ${state} (${reason})`);
  }
}
