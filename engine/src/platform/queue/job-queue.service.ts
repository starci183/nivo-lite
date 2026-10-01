import { Inject, Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE } from "../supabase/supabase.module";
import type { EngineJob, JobResult } from "./queue.types";

/** The queue RPC surface (engine_* functions, service role only). Every transition is guarded by `locked_by = worker` in SQL. */
@Injectable()
export class JobQueueService {
  constructor(@Inject(SUPABASE) private readonly db: SupabaseClient) {}

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }

  async claim(worker: string, kinds: ReadonlyArray<string>, limit: number, leaseSeconds: number): Promise<ReadonlyArray<EngineJob>> {
    return (await this.rpc<EngineJob[] | null>("engine_claim_jobs", { p_worker: worker, p_kinds: kinds, p_limit: limit, p_lease_seconds: leaseSeconds })) ?? [];
  }

  /** False = the lease is no longer ours (expired and re-claimed, or cancelled): stop working on the job. */
  heartbeat(jobId: string, worker: string, leaseSeconds: number): Promise<boolean> {
    return this.rpc<boolean>("engine_heartbeat_job", { p_job: jobId, p_worker: worker, p_lease_seconds: leaseSeconds });
  }

  complete(jobId: string, worker: string, result: JobResult): Promise<boolean> {
    return this.rpc<boolean>("engine_complete_job", { p_job: jobId, p_worker: worker, p_result: result });
  }

  /** Returns the new status of the job ("queued" = will retry, "failed" = done trying) or null when the job is no longer ours. */
  fail(jobId: string, worker: string, error: string, opts: { retryAfterSeconds?: number; permanent?: boolean } = {}): Promise<string | null> {
    return this.rpc<string | null>("engine_fail_job", { p_job: jobId, p_worker: worker, p_error: error, p_retry_after_seconds: opts.retryAfterSeconds ?? null, p_permanent: opts.permanent ?? false });
  }

  release(jobId: string, worker: string): Promise<boolean> {
    return this.rpc<boolean>("engine_release_job", { p_job: jobId, p_worker: worker });
  }

  async workerHeartbeat(worker: string, version: string, kinds: ReadonlyArray<string>, info: Record<string, unknown>): Promise<void> {
    await this.rpc<unknown>("engine_worker_heartbeat", { p_worker: worker, p_version: version, p_kinds: kinds, p_info: info });
  }
}
