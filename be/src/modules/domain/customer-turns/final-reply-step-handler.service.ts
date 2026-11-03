import { outputScopeSchema } from "./output-steps.schema"
import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentMessagesService, DELIVERY_OUTCOME_UNKNOWN } from "@modules/domain/agent-messages"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { AgentStepHandler, StepAnswer, StepView } from "@modules/domain/agent-runs"
import { ChatTurnService } from "@modules/domain/conversations"
import type { CustomerTurn } from "@modules/domain/conversations"
import type { DeliveryOutcome } from "@modules/domain/channels"
import { CustomerDeliveryService } from "@modules/domain/work-performers"
import { FinalReplyService } from "./final-reply.service"
import { FINAL_REPLY_STEP_KIND, outputsOf } from "./output-steps.policy"
import type { OutputScope } from "./output-steps.schema"

/** Why the row cannot run. */
const INVALID_INPUT = "invalid_input"
/** Why it cannot be retried: the customer message is gone, so there is no turn to answer. */
const TARGET_GONE = "target_gone"
/** The stored reply remains pending until its channel accepts it. */
const DELIVERY_UNAVAILABLE = "delivery_unavailable"

@Injectable()
/**
 * The step that answers the customer after an output, from its row and the results of the steps before it, so a kill between the tool's
 * result and the reply resumes here and still delivers. The reply stored for the message or the work item is the key: a retry finds it
 * and sends only after a definite refusal; an unacknowledged send waits for reconciliation. It writes and judges nothing again. A new reply passes the same gate as any other, and what the gate holds stays
 * with a person.
 */
export class FinalReplyStepHandlerService implements AgentStepHandler, OnModuleInit {
    /** The kind it runs. */
    readonly kind: "final_reply" = FINAL_REPLY_STEP_KIND

    constructor(
        private readonly handlers: AgentRunHandlersService,
        private readonly chat: ChatTurnService,
        private readonly finals: FinalReplyService,
        private readonly messages: AgentMessagesService,
        private readonly delivery: CustomerDeliveryService,
    ) {}

    /** Registers with the run engine once the app has started. */
    onModuleInit(): void {
        this.handlers.add(this)
    }

    /** Writes, judges and delivers the one reply of the run. */
    async run(step: StepView): Promise<StepAnswer> {
        const parsed = outputScopeSchema.safeParse(step.input)
        if (!parsed.success) return { kind: "failed", code: INVALID_INPUT }
        const scope = parsed.data
        const turn = await this.chat.turnOf({
            conversationId: scope.conversationId,
            messageId: scope.messageId,
            channelEventId: "",
        })
        if (turn === undefined) return { kind: "failed", code: TARGET_GONE }
        const key = scope.workItemId ?? scope.messageId
        const stored = await this.messages.storedReply(scope.conversationId, scope.messageId, scope.workItemId)
        const reply = stored ?? (await this.written(turn, scope, step, key))
        const send = stored !== null || (await this.chat.settleLate(turn, reply, key)).send
        if (send) {
            const delivered = await this.deliver(turn, scope, reply)
            if (delivered === "ambiguous") return { kind: "failed", code: DELIVERY_OUTCOME_UNKNOWN }
            if (delivered === "rejected") return { kind: "retry", code: DELIVERY_UNAVAILABLE }
        }
        return { kind: "done", result: { reply, sent: send, declined: scope.declined }, next: [] }
    }

    private written(turn: CustomerTurn, scope: OutputScope, step: StepView, key: string): Promise<string> {
        if (scope.declined) return Promise.resolve(this.finals.declined())
        return this.finals.write(turn, outputsOf(step.earlier, scope.workItemId), key, scope.planned)
    }

    private deliver(turn: CustomerTurn, scope: OutputScope, reply: string): Promise<DeliveryOutcome> {
        if (scope.workItemId === null) {
            return this.chat.sendReply(turn, reply)
        }
        return this.delivery.finalInConversation(
            turn.conversation.workspaceId,
            scope.conversationId,
            reply,
            scope.workItemId,
        )
    }
}
