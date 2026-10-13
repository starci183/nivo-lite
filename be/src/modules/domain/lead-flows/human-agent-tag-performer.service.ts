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
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LeadFlowKitService } from "./lead-flow-kit.service"

@Injectable()
/** `message_with_human_agent_tag`: a person's reply between 24 hours and 7 days, with the HUMAN_AGENT tag (ask mode only). */
export class HumanAgentTagPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly kit: LeadFlowKitService,
    ) {}

    /** Registers the performer with the work engine. */
    onModuleInit(): void {
        this.registry.add("message_with_human_agent_tag", this)
    }

    /** The proposal carries the text the step could not send. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Sends the approved text with the tag; over seven days nothing may go. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const draft = proposal.draft ?? ""
        const outcome = await this.kit.dm(ctx, flow, draft, true)
        if (!outcome.ok && outcome.reason === "window")
            throw new LeadFlowsError({ code: LeadFlowsErrorCode.WindowClosed })
        if (!outcome.ok) throw this.kit.metaRefused(outcome.detail ?? outcome.reason)
        return this.kit.done(this.kit.text(ctx.locale, "tag.done", { name: this.kit.nameOf(ctx, flow) }), flow, draft)
    }
}
