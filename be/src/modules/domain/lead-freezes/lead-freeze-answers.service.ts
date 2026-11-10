import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { stuckKeyOf } from "@modules/domain/agent-graphs"
import { StopAnswersService } from "@modules/domain/agent-threads"
import { lineKeyOf, TeamChatRoomsService, type AgentLineReplied } from "@modules/domain/team-chat"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { LeadFreezeDoorService } from "./lead-freeze-door.service"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"

@Injectable()
/**
 * The founder's answer in the team chat: a reply to the report of a stuck step is the answer the workflow waits for. The team chat has
 * one listener for such replies, and this is it, so it routes. A reply to the card of a STOP of a thread run (`engine = langgraph`) goes
 * to the stops (`StopAnswersService`): the words resume that step, or a stop already resolved is told so and nothing moves. Any other
 * reply takes the old engine's path unchanged: it is matched to the freeze whose run and step the report names, and answered through
 * the freeze's own door as "retry" by the person who wrote it, so who may answer (an owner or a manager), the freeze's item, the decision
 * log and the run all move as they do from the buttons. A reply by someone who may not decide, or to a line that is no report of a
 * stuck step, changes nothing.
 */
export class LeadFreezeAnswersService implements OnModuleInit {
    constructor(
        private readonly records: LeadFreezeRecordsService,
        private readonly door: LeadFreezeDoorService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly chat?: TeamChatRoomsService,
        @Optional() private readonly stops?: StopAnswersService,
    ) {}

    /** Registers with the team chat once the app has started; an app without the chat hears nothing. */
    onModuleInit(): void {
        this.chat?.listenReplies(async (reply) => {
            await this.replied(reply)
        })
    }

    /** Hands the reply to the stop or the freeze whose report it answers; true when a resume or a retry was asked. */
    async replied(reply: AgentLineReplied): Promise<boolean> {
        const stopped = await this.stops?.replied(reply)
        if (stopped != null) {
            this.logger.info(LeadFreezesLogEvent.AnsweredInChat, { runId: stopped.runId, outcome: stopped.outcome })
            return stopped.outcome === "admitted" || stopped.outcome === "already_admitted"
        }
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
