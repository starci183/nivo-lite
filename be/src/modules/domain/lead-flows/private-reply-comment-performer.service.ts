import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type {
    Performed,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LeadFlowsLogEvent } from "./lead-flows.log-events"
import { field } from "./lead-flow-fields.policy"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { platformOf } from "./lead-flow.mapper"
import type { LeadFlow, LeadFlowPatch } from "./lead-flows.contracts"

const EXPIRED: ReadonlySet<string> = new Set(["private_reply_expired", "comment_age_unknown"])

@Injectable()
/**
 * `private_reply_comment`: one private message per comment, within 7 days of it. The person it reaches gets a real Messenger / Instagram
 * id, which links their later messages to this prospect.
 */
export class PrivateReplyCommentPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly kit: LeadFlowKitService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Registers the performer with the work engine. */
    onModuleInit(): void {
        this.registry.add("private_reply_comment", this)
    }

    /** The private message of the turn, or the plain greeting. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const plain =
            flow.name === null
                ? this.kit.text(ctx.locale, "line.private-greet")
                : this.kit.text(ctx.locale, "line.private-greet-named", { name: flow.name })
        const draft = field(item.proposal.fields, "private_reply") || item.proposal.draft || plain
        const summary = this.kit.text(ctx.locale, "private.summary", { name: this.kit.nameOf(ctx, flow, "commenter") })
        return { proposal: { ...item.proposal, summary, draft } }
    }

    /** Sends the one private reply; a repeat or an expired comment is not an error. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const fields = proposal.fields
        const commentId = field(fields, "comment_id")
        const draft = proposal.draft ?? ""
        if (commentId === "") throw new LeadFlowsError({ code: LeadFlowsErrorCode.NoComment })
        const connectionId = field(fields, "connection_id") || flow.connection_id
        if (connectionId === null) throw new LeadFlowsError({ code: LeadFlowsErrorCode.NoPage })
        const platform = platformOf(flow.platform)
        const outcome = await this.kit.meta.privateReply(
            { workspaceId: ctx.workspaceId, connectionId, platform, commentId },
            draft,
        )
        if (outcome === null) throw new LeadFlowsError({ code: LeadFlowsErrorCode.NoPage })
        if (!outcome.ok && outcome.failure === "already_replied")
            return this.kit.done(this.kit.text(ctx.locale, "private.already"), flow)
        if (!outcome.ok && EXPIRED.has(outcome.failure ?? ""))
            return this.kit.done(this.kit.text(ctx.locale, "private.expired"), flow)
        if (!outcome.ok) throw this.kit.metaRefused(outcome.failure)
        await this.linkPerson(flow, outcome.recipientId)
        await this.kit.transcript.say({
            workspaceId: ctx.workspaceId,
            conversationId: field(fields, "conversation_id") || flow.conversation_id,
            role: "agent",
            body: draft,
            delivery: { sent: true, error: null },
        })
        const name = this.kit.nameOf(ctx, flow, "commenter")
        return this.kit.done(this.kit.text(ctx.locale, "private.done", { name }), flow, draft)
    }

    /** The flow is greeted, and learns the id the private message reached (another flow may already hold it). */
    private async linkPerson(flow: LeadFlow, recipientId: string | null): Promise<void> {
        const base: LeadFlowPatch = {
            greeted_at: this.kit.now(),
            ...(flow.state === "new" ? { state: "greeted" as const } : {}),
        }
        let person: LeadFlowPatch = {}
        if (recipientId !== null && flow.platform === "instagram" && flow.igsid === null)
            person = { igsid: recipientId }
        if (recipientId !== null && flow.platform !== "instagram" && flow.psid === null) person = { psid: recipientId }
        try {
            await this.kit.store.patch(flow, { ...base, ...person })
        } catch (cause) {
            this.logger.error(LeadFlowsLogEvent.PersonNotLinked, cause, { flowId: flow.id })
            await this.kit.store.patch(flow, base)
        }
    }
}
