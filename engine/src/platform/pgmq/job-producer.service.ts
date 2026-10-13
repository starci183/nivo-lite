import { Inject, Injectable } from "@nestjs/common"
import type { SupabaseClient } from "@supabase/supabase-js"
import { SUPABASE } from "../supabase/supabase.module"
import { JOB_QUEUE, type JobName, type JobPayloads } from "./contracts"

/**
 * The engine's producer: RPC job_enqueue (service role) writes the outbox row and sends the pgmq message in one transaction, so a chained
 * job (index -> facts, a reembed follow-up) is as durable and as deduplicated as one the web enqueued. `dedupe` is the job's identity: the
 * same key twice is one job. Returns the outbox row id.
 */
@Injectable()
export class JobProducer {
    constructor(@Inject(SUPABASE) private readonly db: SupabaseClient) {}

    async enqueue<N extends JobName>(
        name: N,
        payload: JobPayloads[N],
        dedupe: string,
        workspaceId: string | null,
    ): Promise<string> {
        const { data, error } = await this.db.rpc("job_enqueue", {
            p_workspace: workspaceId,
            p_queue: JOB_QUEUE[name],
            p_name: name,
            p_payload: payload,
            p_dedupe: dedupe,
        })
        if (error) throw Object.assign(new Error(`job_enqueue ${name}: ${error.message}`), { retryable: true })
        return data as string
    }
}
