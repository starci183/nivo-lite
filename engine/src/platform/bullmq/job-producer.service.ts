import { Inject, Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE } from "../supabase/supabase.module";
import { JOB_QUEUE, type JobName, type JobPayloads } from "./contracts";

/**
 * The engine's producer: a job is an outbox row (RPC job_enqueue, service role), never a direct BullMQ add, so a chained job (index ->
 * facts) is as durable as one the web app enqueued and goes through the same relay. `dedupe` is the job's identity: the same key twice is
 * one job. Returns the outbox row id.
 */
@Injectable()
export class JobProducer {
  constructor(@Inject(SUPABASE) private readonly db: SupabaseClient) {}

  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N], dedupe: string, workspaceId: string | null): Promise<string> {
    const { data, error } = await this.db.rpc("job_enqueue", { p_workspace: workspaceId, p_queue: JOB_QUEUE[name], p_name: name, p_payload: payload, p_dedupe: dedupe });
    if (error) throw new Error(`job_enqueue: ${error.message}`);
    return data as string;
  }
}
