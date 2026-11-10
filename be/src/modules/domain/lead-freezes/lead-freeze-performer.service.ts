import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { StopDoorService, type StopDoorOutcome } from "@modules/domain/agent-threads"
import {
    InjectWorkPerformerRegistry,
    type Performed,
    type PerformedBy,
    type Prepared,
    type Proposal,
    type WorkContext,
    type WorkItem,
    type WorkPerformer,
    type WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { LEAD_FROZEN_ACTION } from "./lead-freeze-items.service"
import { LeadFreezesService } from "./lead-freezes.service"
import type { FreezeOutcome } from "./lead-freezes.contracts"

/** The key of the line the decision log keeps for an outcome of the owner's answer. */
const outcomeKeyOf = (outcome: FreezeOutcome): string => `leadFreezes.outcome.${outcome}`

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** Who answered, as the run keeps it: their member id, else their name. */
const actorOf = (by: PerformedBy): string => ("memberId" in by ? by.memberId : undefined) ?? by.name

/** A retry handed to the stop of a thread run, as the decision log words it: queued for the step, or nothing left to retry. */
const threadOutcomeOf = (outcome: StopDoorOutcome): FreezeOutcome =>
    outcome === "admitted" || outcome === "already_admitted" || outcome === "step_running" ? "retrying" : "not_frozen"

@Injectable()
/**
 * `lead_frozen`: the owner's one item per frozen customer. Approving it is "Retry" (the failed run again from its failed step), rejecting
 * it is "Skip this turn" (the run given up, the customer released); "Take over" is its own door, since it closes nothing. A retry that did
 * not release the customer opens the next item before this one closes, so the customer is never left without one. When the frozen run is
 * a thread run (`engine = langgraph`), the decision goes to its stop instead (`retry` or `skip` through the stop door, as the person
 * who decided): the thread moves under its own lease, and the freeze follows its stop.
 */
export class LeadFreezePerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly freezes: LeadFreezesService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @Optional() private readonly stops?: StopDoorService,
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
        const outcome = freezeId === "" ? "not_frozen" : await this.retried(ctx.workspaceId, freezeId, by)
        const summary = this.catalog.get(outcomeKeyOf(outcome), {}, ctx.locale)
        return { summary, evidence: "captured", lead_id: item.lead_id }
    }

    /** "Skip this turn": gives the failed run up and releases the customer. */
    async onReject(ctx: WorkContext, _item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<void> {
        const freezeId = textOf(proposal.fields.freezeId)
        if (freezeId === "") return
        const runId = await this.threadRunOf(ctx.workspaceId, freezeId)
        if (runId !== null && this.stops !== undefined) {
            await this.stops.apply(
                { memberId: actorOf(by), name: by.name },
                { workspaceId: ctx.workspaceId, runId, action: "skip" },
            )
            return
        }
        await this.freezes.skip(ctx.workspaceId, freezeId, actorOf(by))
    }

    private async retried(workspaceId: string, freezeId: string, by: PerformedBy): Promise<FreezeOutcome> {
        const runId = await this.threadRunOf(workspaceId, freezeId)
        if (runId !== null && this.stops !== undefined) {
            const answered = await this.stops.apply(
                { memberId: actorOf(by), name: by.name },
                { workspaceId, runId, action: "retry" },
            )
            return threadOutcomeOf(answered.outcome)
        }
        const outcome = await this.freezes.retry(workspaceId, freezeId, actorOf(by))
        if (outcome === "still_frozen" || outcome === "not_retryable") await this.freezes.reraise(workspaceId, freezeId)
        return outcome
    }

    /** The run of the freeze when it is a thread run whose stop the decision belongs to; null for the old engine's runs. */
    private async threadRunOf(workspaceId: string, freezeId: string): Promise<string | null> {
        if (this.stops === undefined) return null
        const runId = (await this.freezes.stateOf(workspaceId, freezeId))?.runId ?? null
        return runId !== null && (await this.stops.isThreadRun(workspaceId, runId)) ? runId : null
    }
}
