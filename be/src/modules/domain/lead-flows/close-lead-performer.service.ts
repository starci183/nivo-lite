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
import { LeadFlowKitService } from "./lead-flow-kit.service"

@Injectable()
/** `close_lead`: a cold lead gets one polite closing line inside the window, then the bot stops; outside it the flow closes silently. */
export class CloseLeadPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly kit: LeadFlowKitService,
    ) {}

    /** Registers the performer with the work engine. */
    onModuleInit(): void {
        this.registry.add("close_lead", this)
    }

    /** The reply of the turn, then the closing line. */
    prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return this.kit.lineProposal(ctx, item, "line.close", "close.summary")
    }

    /** Sends the line inside the window and closes the flow either way. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const draft = proposal.draft?.trim() ?? ""
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        if (draft === "") return this.kit.done(this.kit.text(ctx.locale, "close.already"), flow)
        const outcome = await this.kit.dm(ctx, flow, draft)
        if (outcome.reason === "failed") throw this.kit.metaRefused(outcome.detail)
        await this.kit.store.patch(flow, { state: "closed", closed_at: this.kit.now(), pending_question: null })
        return outcome.ok
            ? this.kit.done(this.kit.text(ctx.locale, "close.done", { name: this.kit.nameOf(ctx, flow) }), flow, draft)
            : this.kit.done(this.kit.text(ctx.locale, "close.silent"), flow)
    }
}
