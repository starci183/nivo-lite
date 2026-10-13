import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { DecisionsError, DecisionsErrorCode, InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { field } from "./lead-flow-fields.policy"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { platformOf } from "./lead-flow.mapper"

@Injectable()
/**
 * `reply_comment_public`: a short public reply under the comment. A negative comment is proposed as an ask: the bot goes quiet on the
 * prospect and the reply waits for a person. The transcript line is stored once under the item, so a retry never posts twice.
 */
export class ReplyCommentPublicPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly kit: LeadFlowKitService,
    ) {}

    /** Registers the performer with the work engine. */
    onModuleInit(): void {
        this.registry.add("reply_comment_public", this)
    }

    /** The public reply of the turn, or the plain line; a negative comment hands the prospect to a person first. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const fields = item.proposal.fields
        const negative = field(fields, "negative") === "1"
        const name = this.kit.nameOf(ctx, flow)
        if (negative)
            await this.kit.holdForPerson(ctx, {
                flow,
                reason: "negative_comment",
                itemId: item.id,
                question: field(fields, "text") || (flow.last_user_text ?? ""),
                notify: false,
            })
        const draft =
            field(fields, "public_reply") || item.proposal.draft || this.kit.text(ctx.locale, "line.public-reply")
        const summary = this.kit.text(ctx.locale, negative ? "public.negative" : "public.summary", { name })
        // A negative comment is unclear to the gate: the public reply waits for a person.
        return { proposal: { ...item.proposal, summary, draft, ...(negative ? { outcome: "unclear" as const } : {}) } }
    }

    /** Posts the reply and answers success only after Meta accepted it. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        if (item.origin !== "live") throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const fields = proposal.fields
        const commentId = field(fields, "comment_id")
        const draft = proposal.draft?.trim() ?? ""
        if (commentId === "" || draft === "") throw new LeadFlowsError({ code: LeadFlowsErrorCode.NoComment })
        const connectionId = field(fields, "connection_id") || flow.connection_id
        const conversationId = field(fields, "conversation_id") || flow.conversation_id
        if (connectionId === null) throw new LeadFlowsError({ code: LeadFlowsErrorCode.NoPage })
        const line =
            conversationId === null
                ? null
                : await this.kit.transcript.stableLine(
                      ctx.workspaceId,
                      conversationId,
                      this.kit.text(ctx.locale, "public.line", { draft }),
                      by.name,
                      item.id,
                  )
        if (line?.sent !== true) {
            const outcome = await this.kit.meta.publicReply(
                {
                    workspaceId: ctx.workspaceId,
                    connectionId,
                    platform: platformOf(field(fields, "platform") || flow.platform),
                    commentId,
                },
                draft,
            )
            if (outcome === null) throw new LeadFlowsError({ code: LeadFlowsErrorCode.NoPage })
            if (line !== null) await this.kit.transcript.markDelivery(line.id, outcome.ok, outcome.failure)
            if (!outcome.ok) throw this.kit.metaRefused(outcome.failure)
        }
        return this.kit.done(
            this.kit.text(ctx.locale, "public.done", { name: this.kit.nameOf(ctx, flow) }),
            flow,
            draft,
        )
    }
}
