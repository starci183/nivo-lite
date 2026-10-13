import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { N8N_QUEUE, N8N_EMIT_JOB } from "@modules/queues/n8n"
import { EmitN8nEventStep } from "../../steps/deliver.step"

@Injectable()
/** The processor of the n8n delivery job: the runner claims and settles it; the one step posts the signed event to the shared workflows. */
export class EmitN8nEventProcessor extends FencedProcessor {
    readonly queue = N8N_QUEUE
    override readonly job = N8N_EMIT_JOB

    constructor(private readonly step: EmitN8nEventStep) {
        super()
    }

    /** Runs the one step; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
