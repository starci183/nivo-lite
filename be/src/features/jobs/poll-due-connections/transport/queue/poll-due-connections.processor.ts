import { Injectable } from "@nestjs/common"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import { CONNECTION_POLL_QUEUE } from "@modules/queues/connection-poll"
import { PollDueStep } from "../../steps/poll-due.step"

@Injectable()
/** The processor of the poll-due-connections job: every scheduler tick runs the one step. */
export class PollDueConnectionsProcessor extends FencedProcessor {
    readonly queue: "connection-poll" = CONNECTION_POLL_QUEUE

    constructor(private readonly pollDue: PollDueStep) {
        super()
    }

    /** Polls what is due; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.pollDue.run(job)
    }
}
