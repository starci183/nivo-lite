import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { CONNECTION_HEALTH_QUEUE } from "@modules/queues/connection-health"
import { JudgeConnectionsStep } from "../../steps/judge-connections.step"

@Injectable()
/** The processor of the check-connection-health job: every scheduler tick runs the one step. */
export class CheckConnectionHealthProcessor extends FencedProcessor {
    readonly queue = CONNECTION_HEALTH_QUEUE

    constructor(private readonly judge: JudgeConnectionsStep) {
        super()
    }

    /** Judges the connections; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.judge.run(job)
    }
}
