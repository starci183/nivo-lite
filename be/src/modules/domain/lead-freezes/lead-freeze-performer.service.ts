import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectWorkPerformerRegistry } from "@modules/domain/decisions"
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
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LEAD_FROZEN_ACTION } from "./lead-freeze-items.service"
import { LeadFreezesService } from "./lead-freezes.service"
import type { FreezeOutcome } from "./lead-freezes.contracts"

/** The key of the line the decision log keeps for an outcome of the owner's answer. */
const outcomeKeyOf = (outcome: FreezeOutcome): string => `leadFreezes.outcome.${outcome}`

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** Who answered, as the run keeps it: their member id, else their name. */
const actorOf = (by: PerformedBy): string => ("memberId" in by ? by.memberId : undefined) ?? by.name

@Injectable()
/**
 * `lead_frozen`: the owner's one item per frozen customer. Approving it is "Retry" (the failed run again from its failed step), rejecting
 * it is "Skip this turn" (the run given up, the customer released); "Take over" is its own door, since it closes nothing. A retry that did
 * not release the customer opens the next item before this one closes, so the customer is never left without one.
 */
export class LeadFreezePerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly freezes: LeadFreezesService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Registers the performer of the action with the work engine at boot. */
    onModuleInit(): void {
        this.registry.add(LEAD_FROZEN_ACTION, this)
    }

    /** The proposal is preset by the freeze that raised the item. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** "Retry": retries the failed run; when the customer is not released, the next item is raised for them. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const freezeId = textOf(proposal.fields.freezeId)
        const outcome =
            freezeId === "" ? "not_frozen" : await this.freezes.retry(ctx.workspaceId, freezeId, actorOf(by))
        if (outcome === "still_frozen" || outcome === "not_retryable")
            await this.freezes.reraise(ctx.workspaceId, freezeId)
        const summary = this.catalog.get(outcomeKeyOf(outcome), {}, ctx.locale)
        return { summary, evidence: "captured", lead_id: item.lead_id }
    }

    /** "Skip this turn": gives the failed run up and releases the customer. */
    async onReject(ctx: WorkContext, _item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<void> {
        const freezeId = textOf(proposal.fields.freezeId)
        if (freezeId !== "") await this.freezes.skip(ctx.workspaceId, freezeId, actorOf(by))
    }
}
