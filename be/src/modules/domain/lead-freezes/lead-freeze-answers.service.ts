import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { stuckKeyOf } from "@modules/domain/agent-graphs"
import { lineKeyOf, TeamChatRoomsService } from "@modules/domain/team-chat"
import type { AgentLineReplied } from "@modules/domain/team-chat"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeadFreezeDoorService } from "./lead-freeze-door.service"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"

@Injectable()
/**
 * The founder's answer in the team chat: a reply to the report of a stuck step is the answer the workflow waits for. The reply is
 * matched to the freeze whose run and step the report names, and answered through the freeze's own door as "retry" by the person who
 * wrote it, so who may answer (an owner or a manager), the freeze's item, the decision log and the run all move as they do from the
 * buttons. The retry itself reads the replies from the chat and hands them to the step as facts; nothing is kept here. A reply by
 * someone who may not decide, or to a line that is no report of a stuck step, changes nothing.
 */
export class LeadFreezeAnswersService implements OnModuleInit {
    constructor(
        private readonly records: LeadFreezeRecordsService,
        private readonly door: LeadFreezeDoorService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly chat?: TeamChatRoomsService,
    ) {}

    /** Registers with the team chat once the app has started; an app without the chat hears nothing. */
    onModuleInit(): void {
        this.chat?.listenReplies(async (reply) => {
            await this.replied(reply)
        })
    }

    /** Retries the freeze whose report the person replied to; true when a retry was asked. */
    async replied(reply: AgentLineReplied): Promise<boolean> {
        const holding = await this.records.holding(reply.workspaceId)
        const freeze = holding.find(
            (one) =>
                one.status === "frozen" &&
                one.frozenRunId !== null &&
                one.stepKey !== null &&
                lineKeyOf(stuckKeyOf(one.frozenRunId, one.stepKey)) === reply.lineKey,
        )
        if (freeze === undefined) return false
        try {
            const answered = await this.door.answer(reply.byUserId, {
                workspaceId: reply.workspaceId,
                freezeId: freeze.id,
                action: "retry",
                locale: "vi",
            })
            this.logger.info(LeadFreezesLogEvent.AnsweredInChat, { freezeId: freeze.id, outcome: answered.outcome })
            return true
        } catch {
            // The person may not decide for the workspace: their reply stays a message, the freeze stays as it is.
            this.logger.info(LeadFreezesLogEvent.AnsweredInChat, { freezeId: freeze.id, outcome: "not_allowed" })
            return false
        }
    }
}
