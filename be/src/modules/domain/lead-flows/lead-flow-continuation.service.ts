import { Injectable } from "@nestjs/common"
import { CommandBusService, WorkEngineService } from "@modules/domain/decisions"
import type { SendCommandInput, WorkContext } from "@modules/domain/decisions"
import { eachInOrder } from "@modules/platform/primitives"
import { isLeadGenContinuePayload } from "@modules/queues/lead-gen"
import type { LeadGenContinuePayload, LeadGenFinishedStep } from "@modules/queues/lead-gen"
import { LEAD_GEN_ACTOR } from "./lead-flow-conversation.service"
import { field, keep } from "./lead-flow-fields.policy"
import type { FlowFields } from "./lead-flow-fields.policy"

/** How many queued steps of the input one continuation runs after its own command. */
const DRAIN_LIMIT = 10

/** One command the continuation sends. */
interface NextCommand {
    /** The command of the lead_gen module. */
    readonly command: string
    /** Why. */
    readonly reason: string
    /** The proposal fields beyond the lead address. */
    readonly extra: FlowFields
    /** The idempotency key. */
    readonly dedupeKey: string
}

const COMMON = ["turn", "conversation_id", "connection_id", "source_kind", "comment_id", "post_id", "text"] as const
const AFTER_SCORE = ["turn", "conversation_id", "reply", "comment_id", "post_id", "source_kind"] as const

@Injectable()
/**
 * What follows a finished lead_gen step, by the flow's state machine (the decision itself, `fields.step`, was made by score_lead):
 *
 *   capture_lead -> score_lead -> greet_prospect | ask_qualifying | handoff_to_sales | follow_up_lead | close_lead
 *   comment      -> score_lead -> reply_comment_public -> private_reply_comment
 *
 * Every command is the module's own work item through the authority gate. It runs right here (its own continuation is the next job),
 * then the queued steps of the same input run (Sales' classify_lead after a hand-off, a follow-up handed to Sales).
 */
export class LeadFlowContinuationService {
    constructor(
        private readonly commands: CommandBusService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Sends what follows the finished step, then runs the steps its input queued; a delivery of another shape does nothing. */
    async continue(delivered: unknown): Promise<void> {
        if (!isLeadGenContinuePayload(delivered)) return
        const payload = delivered
        const ctx: WorkContext = { workspaceId: payload.workspaceId, actor: LEAD_GEN_ACTOR, locale: payload.locale }
        await eachInOrder(this.nextOf(payload.step), (next) =>
            this.commands.sendCommand(ctx, this.commandOf(payload, next)),
        )
        if (payload.inboundEventId !== null)
            await this.engine.runInboundQueued(ctx, payload.inboundEventId, DRAIN_LIMIT)
    }

    private commandOf(payload: LeadGenContinuePayload, next: NextCommand): SendCommandInput {
        const { step } = payload
        return {
            from: "lead_gen",
            to: "lead_gen",
            command: next.command,
            reason: next.reason,
            parentId: step.id,
            chainId: step.chainId ?? step.id,
            origin: step.origin,
            inboundEventId: payload.inboundEventId,
            dedupeKey: next.dedupeKey,
            payload: { subject_type: "lead", subject_id: step.leadId, lead_id: step.leadId, ...next.extra },
        }
    }

    /** The commands that follow a step; handoff_to_sales is chained by the engine itself (Sales classify_lead). */
    private nextOf(step: LeadGenFinishedStep): ReadonlyArray<NextCommand> {
        const leadId = step.leadId
        if (leadId === null) return []
        const fields = step.fields
        const turn = field(fields, "turn") || step.id
        if (step.action === "capture_lead")
            return [
                {
                    command: "score_lead",
                    reason: "lead_captured",
                    extra: keep(fields, ...COMMON),
                    dedupeKey: `score_lead:${leadId}:${turn}`,
                },
            ]
        if (step.action === "score_lead") return this.afterScore(step, leadId)
        if (step.action === "reply_comment_public" && field(fields, "negative") !== "1") {
            const extra = {
                ...keep(fields, "turn", "conversation_id", "comment_id", "post_id", "private_reply", "connection_id"),
            }
            return [
                {
                    command: "private_reply_comment",
                    reason: "comment",
                    extra,
                    dedupeKey: `private_reply_comment:comment:${field(fields, "comment_id")}`,
                },
            ]
        }
        // greet, ask, follow up, close, the private reply and the tagged message: the conversation waits for the next message.
        return []
    }

    private afterScore(step: LeadGenFinishedStep, leadId: string): ReadonlyArray<NextCommand> {
        const fields = step.fields
        const plan = field(fields, "step")
        const turn = field(fields, "turn") || step.id
        const index = Number(fields.index) || 0
        const base = { ...keep(fields, ...AFTER_SCORE), score: field(fields, "score") }
        const out: Array<NextCommand> = []
        if (field(fields, "handoff") === "1" || plan === "handoff")
            out.push({
                command: "handoff_to_sales",
                reason: "hot_lead",
                extra: { contact: field(fields, "contact"), need: field(fields, "need"), score: "hot" },
                dedupeKey: `handoff_to_sales:${leadId}`,
            })
        if (plan === "greet")
            out.push({
                command: "greet_prospect",
                reason: "first_reply",
                extra: base,
                dedupeKey: `greet_prospect:${leadId}`,
            })
        if (plan === "ask")
            out.push({
                command: "ask_qualifying",
                reason: "qualify",
                extra: { ...base, index, question: field(fields, "question") },
                dedupeKey: `ask_qualifying:${leadId}:${index}`,
            })
        if (plan === "ask_contact")
            out.push({
                command: "ask_qualifying",
                reason: "ask_contact",
                extra: { ...base, index, question_kind: "contact" },
                dedupeKey: `ask_qualifying:${leadId}:contact`,
            })
        if (plan === "follow_up")
            out.push({
                command: "follow_up_lead",
                reason: "warm_lead",
                extra: base,
                dedupeKey: `follow_up_lead:${leadId}:${turn}`,
            })
        if (plan === "close")
            out.push({
                command: "close_lead",
                reason: "cold_lead",
                extra: base,
                dedupeKey: `close_lead:${leadId}:${turn}`,
            })
        if (plan === "comment") {
            const negative = field(fields, "negative") === "1"
            out.push({
                command: "reply_comment_public",
                reason: negative ? "negative_comment" : "comment",
                extra: {
                    ...base,
                    ...keep(fields, "public_reply", "private_reply", "negative", "text"),
                    connection_id: field(fields, "connection_id"),
                },
                dedupeKey: `reply_comment_public:comment:${field(fields, "comment_id")}`,
            })
        }
        return out
    }
}
