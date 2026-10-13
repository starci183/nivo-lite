import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { CHAT_TURN_QUEUE } from "@modules/queues/chat-turn"
import { ReplyStep } from "../../steps/reply.step"

@Injectable()
/** The processor of the run-chat-turn job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class RunChatTurnProcessor extends FencedProcessor {
    readonly queue = CHAT_TURN_QUEUE

    constructor(private readonly reply: ReplyStep) {
        super()
    }

    /** Answers the customer; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.reply.run(job)
    }
}
