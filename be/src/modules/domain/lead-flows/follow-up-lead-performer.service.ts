import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { CommandBusService, InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type {
    Performed,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { LeadFlowKitService } from "./lead-flow-kit.service"

@Injectable()
/** `follow_up_lead`: a warm lead gets one follow-up inside the window; outside it Sales follows up through its own gate. */
export class FollowUpLeadPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly kit: LeadFlowKitService,
        private readonly commands: CommandBusService,
    ) {}

    /** Registers the performer with the work engine. */
    onModuleInit(): void {
        this.registry.add("follow_up_lead", this)
    }

    /** The reply of the turn, then the follow-up line. */
    prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return this.kit.lineProposal(ctx, item, "line.follow-up", "follow.summary")
    }

    /** Sends inside the window; a form lead, a mention or an expired window goes to Sales once. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const draft = proposal.draft?.trim() ?? ""
        if (draft === "") return this.kit.done(this.kit.text(ctx.locale, "follow.already"), flow)
        const first = flow.followed_up_at === null
        const outcome = await this.kit.dm(ctx, flow, draft)
        if (outcome.ok) {
            await this.kit.store.patch(flow, {
                state: "nurturing",
                ...(first ? { followed_up_at: this.kit.now() } : {}),
            })
            return this.kit.done(
                this.kit.text(ctx.locale, "follow.done", { name: this.kit.nameOf(ctx, flow) }),
                flow,
                draft,
            )
        }
        if (outcome.reason === "failed") throw this.kit.metaRefused(outcome.detail)
        if (!first) return this.kit.done(this.kit.notSent(ctx.locale, outcome), flow)
        // A follow-up is marketing, so no tag either: Sales gets it as its own gated follow-up.
        await this.commands.sendCommand(ctx, {
            from: "lead_gen",
            to: "sales",
            command: "send_follow_up",
            reason: "warm_lead_outside_window",
            parentId: item.id,
            chainId: item.chain_id ?? item.id,
            inboundEventId: item.inbound_event_id,
            queue: true,
            dedupeKey: `send_follow_up:lead_gen:${flow.id}`,
            payload: { subject_type: "lead", subject_id: flow.lead_id, lead_id: flow.lead_id },
        })
        await this.kit.store.patch(flow, { state: "nurturing", followed_up_at: this.kit.now() })
        return this.kit.done(this.kit.text(ctx.locale, "follow.to-sales"), flow)
    }
}
