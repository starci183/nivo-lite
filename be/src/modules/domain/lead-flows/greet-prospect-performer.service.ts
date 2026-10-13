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
import { field } from "./lead-flow-fields.policy"
import { LeadFlowKitService } from "./lead-flow-kit.service"

@Injectable()
/** `greet_prospect`: the first reply inside the 24 hour window, composed from public knowledge in the brand voice. */
export class GreetProspectPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly kit: LeadFlowKitService,
    ) {}

    /** Registers the performer with the work engine. */
    onModuleInit(): void {
        this.registry.add("greet_prospect", this)
    }

    /** The turn's reply, or the plain greeting when a person asked for a greet without one. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const plain =
            flow.name === null
                ? this.kit.text(ctx.locale, "line.greet")
                : this.kit.text(ctx.locale, "line.greet-named", { name: flow.name })
        const draft = field(item.proposal.fields, "reply") || item.proposal.draft || plain
        const summary = this.kit.text(ctx.locale, "greet.summary", { name: this.kit.nameOf(ctx, flow) })
        return { proposal: { ...item.proposal, summary, draft } }
    }

    /** Sends the greeting inside the window, once. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        if (flow.greeted_at !== null) return this.kit.done(this.kit.text(ctx.locale, "greet.already"), flow)
        const text = proposal.draft ?? ""
        const sent = await this.kit.dmOrExplain(ctx, item, flow, text, true)
        if (!sent.sent) return this.kit.done(sent.line, flow)
        await this.kit.store.patch(flow, {
            state: flow.state === "qualifying" ? flow.state : "greeted",
            greeted_at: this.kit.now(),
        })
        return this.kit.done(this.kit.text(ctx.locale, "greet.done", { name: this.kit.nameOf(ctx, flow) }), flow, text)
    }
}
