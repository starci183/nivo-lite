import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { INVITE_COMMAND_QUEUE } from "@modules/queues/invite-command"
import { IssueInviteStep } from "../../steps/issue-invite.step"

@Injectable()
/** The processor of the issue-invite job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class IssueInviteProcessor extends FencedProcessor {
    readonly queue = INVITE_COMMAND_QUEUE

    constructor(private readonly issue: IssueInviteStep) {
        super()
    }

    /** Serves the invitation command; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.issue.run(job)
    }

    /** The job ended as failed: the command is settled as failed so the asker is told. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.issue.abandon(delivery.payload)
    }
}
