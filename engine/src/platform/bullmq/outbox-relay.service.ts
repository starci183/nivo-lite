import { BeforeApplicationShutdown, Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE } from "../supabase/supabase.module";
import { BULLMQ_OPTIONS, type BullmqOptions } from "./bullmq.config";
import { QUEUES } from "./contracts";
import { QueueTransport } from "./queue-transport.service";

/** One job_outbox row as job_outbox_claim returns it. */
type OutboxRow = { readonly id: string; readonly workspace_id: string | null; readonly queue: string; readonly name: string; readonly payload: unknown; readonly dedupe_key: string; readonly attempts: number };

export type RelaySnapshot = { readonly running: boolean; readonly lastPassAt: string | null; readonly lastPassOk: boolean; readonly relayed: number; readonly lastError: string | null };

/** What /healthz reports and the watchdog alerts on. Refreshed every STATS_MS in the background, so /healthz itself never waits on Supabase or Redis. */
export type JobsStats = {
  readonly outbox: { readonly oldestUnrelayedAgeSeconds: number; readonly unrelayed: number; readonly checkedAt: string | null };
  readonly jobs: { readonly failed: number; readonly waiting: number; readonly active: number; readonly delayed: number; readonly checkedAt: string | null };
};

const STATS_MS = 10_000;

/**
 * The relay of the job outbox: claim waiting rows (job_outbox_claim: FOR UPDATE SKIP LOCKED, so several engines never take the same row),
 * add each to BullMQ with the deterministic id of its dedupe key, then mark them relayed (job_outbox_relayed). Rows Redis refused are handed
 * back with the reason (job_outbox_release). A crash between add and mark leaves the claim to expire (30 s) and the row is added again,
 * which BullMQ ignores because it already holds that id: at least once into Redis, exactly one job.
 * A full batch is followed immediately by the next pass; otherwise the loop waits JOBS_RELAY_MS (1 s by default).
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly log = new Logger("outbox-relay");
  private stopping = false;
  private loop: Promise<void> | null = null;
  private wake: (() => void) | null = null;
  private state: RelaySnapshot = { running: false, lastPassAt: null, lastPassOk: false, relayed: 0, lastError: null };
  private oldestUnrelayedAt: number | null = null;
  private unrelayed = 0;
  private outboxCheckedAt: string | null = null;
  private jobCounts = { failed: 0, waiting: 0, active: 0, delayed: 0 };
  private jobsCheckedAt: string | null = null;
  private statsTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(SUPABASE) private readonly db: SupabaseClient,
    @Inject(BULLMQ_OPTIONS) private readonly options: BullmqOptions,
    private readonly transport: QueueTransport,
  ) {}

  snapshot(): RelaySnapshot {
    return this.state;
  }

  /** Outbox lag and BullMQ failed count (cached; the age grows live between refreshes). */
  stats(): JobsStats {
    const age = this.oldestUnrelayedAt === null ? 0 : Math.max(0, Math.round((Date.now() - this.oldestUnrelayedAt) / 1000));
    return {
      outbox: { oldestUnrelayedAgeSeconds: age, unrelayed: this.unrelayed, checkedAt: this.outboxCheckedAt },
      jobs: { ...this.jobCounts, checkedAt: this.jobsCheckedAt },
    };
  }

  private async refreshStats(): Promise<void> {
    try {
      const oldest = await this.db.from("job_outbox").select("created_at").is("relayed_at", null).order("created_at").limit(1);
      const count = await this.db.from("job_outbox").select("id", { count: "exact", head: true }).is("relayed_at", null);
      if (!oldest.error && !count.error) {
        const row = (oldest.data ?? [])[0] as { created_at: string } | undefined;
        this.oldestUnrelayedAt = row ? Date.parse(row.created_at) : null;
        this.unrelayed = count.count ?? 0;
        this.outboxCheckedAt = new Date().toISOString();
      }
    } catch {
      // keep the last value; checkedAt shows how old it is
    }
    if (!this.options.redisUrl) return;
    try {
      const sum = { failed: 0, waiting: 0, active: 0, delayed: 0 };
      for (const queue of Object.values(QUEUES)) {
        const c = await this.transport.queueOf(queue).getJobCounts("failed", "waiting", "active", "delayed");
        sum.failed += c.failed ?? 0;
        sum.waiting += c.waiting ?? 0;
        sum.active += c.active ?? 0;
        sum.delayed += c.delayed ?? 0;
      }
      this.jobCounts = sum;
      this.jobsCheckedAt = new Date().toISOString();
    } catch {
      // Redis down: /readyz says so; keep the last counts
    }
  }

  onApplicationBootstrap(): void {
    void this.refreshStats();
    this.statsTimer = setInterval(() => void this.refreshStats(), STATS_MS);
    if (!this.options.redisUrl) {
      this.log.warn("REDIS_URL not set: the outbox relay is off (jobs wait in job_outbox until it runs)");
      return;
    }
    this.state = { ...this.state, running: true };
    this.loop = this.run();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.wake?.();
    await this.loop;
    this.state = { ...this.state, running: false };
  }

  /** One pass; returns how many rows were relayed. Exposed for the e2e script and ops. */
  async relayOnce(): Promise<number> {
    const { data, error } = await this.db.rpc("job_outbox_claim", { p_limit: this.options.relayBatch });
    if (error) throw new Error(`job_outbox_claim: ${error.message}`);
    const rows = (data ?? []) as ReadonlyArray<OutboxRow>;
    if (rows.length === 0) return 0;
    const done: Array<string> = [];
    const refused: Array<{ id: string; error: string }> = [];
    for (const row of rows) {
      try {
        await this.transport.add(row.queue, row.name, row.payload, row.dedupe_key);
        done.push(row.id);
      } catch (e) {
        refused.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (done.length) {
      const r = await this.db.rpc("job_outbox_relayed", { p_ids: done });
      if (r.error) throw new Error(`job_outbox_relayed: ${r.error.message}`);
    }
    for (const f of refused) {
      this.log.warn(`outbox row ${f.id} refused by Redis: ${f.error}`);
      await this.db.rpc("job_outbox_release", { p_ids: [f.id], p_error: f.error });
    }
    if (refused.length && !done.length) throw new Error(refused[0]?.error ?? "redis refused the batch");
    return done.length;
  }

  private async run(): Promise<void> {
    this.log.log(`outbox relay up (every ${this.options.relayIntervalMs}ms, batch ${this.options.relayBatch})`);
    let failures = 0;
    while (!this.stopping) {
      let relayed = 0;
      try {
        relayed = await this.relayOnce();
        failures = 0;
        this.state = { ...this.state, lastPassAt: new Date().toISOString(), lastPassOk: true, relayed: this.state.relayed + relayed, lastError: null };
        if (relayed > 0) this.log.log(`relayed ${relayed} job(s)`);
      } catch (e) {
        failures++;
        const message = e instanceof Error ? e.message : String(e);
        if (failures === 1 || failures % 30 === 0) this.log.warn(`relay pass failed (${failures}x): ${message}`);
        this.state = { ...this.state, lastPassAt: new Date().toISOString(), lastPassOk: false, lastError: message };
      }
      if (this.stopping) break;
      if (relayed >= this.options.relayBatch) continue;
      // Back off up to 15 s while the database or Redis is down; 1 s otherwise.
      await this.sleep(Math.min(15_000, this.options.relayIntervalMs * 2 ** Math.min(failures, 4)));
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.wake = null; resolve(); }, ms);
      this.wake = () => { clearTimeout(timer); this.wake = null; resolve(); };
    });
  }
}
