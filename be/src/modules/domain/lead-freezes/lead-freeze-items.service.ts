import { Injectable } from "@nestjs/common"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkSpec } from "@modules/domain/decisions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsService } from "@modules/domain/work-items"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { itemAnswersOf, itemSummaryOf } from "./lead-freeze.policy"
import type { Say } from "./lead-freeze.policy"
import type { FreezeLocale, LeadFreeze } from "./lead-freezes.contracts"

/** The action of the owner's one item per frozen customer: approving retries the failed run, rejecting skips the turn. */
export const LEAD_FROZEN_ACTION = "lead_frozen"

/** The name under which the engine raises the item in the Office. */
const ACTOR = "NIVO"

/** The business key of the item of one freeze: one per freeze and failure, so a failure after a decided item opens the next one. */
const dedupeKeyOf = (freeze: LeadFreeze): string => `lead-freeze:${freeze.id}:${freeze.episode}:${freeze.failures}`

/** The fields of the item: what the cards name, and what each answer does. */
const fieldsOf = (freeze: LeadFreeze, say: Say): Readonly<Record<string, string | number | null>> => ({
    freezeId: freeze.id,
    runId: freeze.frozenRunId,
    leadId: freeze.leadId,
    conversationId: freeze.conversationId,
    code: freeze.frozenReason,
    step: freeze.stepTitle,
    failures: freeze.failures,
    ...itemAnswersOf(say),
})

@Injectable()
/**
 * The owner's one item per frozen customer, through the work engine like every owner decision: it shows in the Inputs page and the For-you list,
 * approving it retries the failed run and rejecting it skips the turn (the performer of `lead_frozen`). A later failure updates the item
 * while it still waits; once it was decided, the next failure opens the next one, so one item at a time waits for the customer.
 */
export class LeadFreezeItemsService {
    constructor(
        private readonly engine: WorkEngineService,
        private readonly items: WorkItemsService,
        private readonly installations: InstallationRecordsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** The words of the item in the owner's language. */
    private sayIn(locale: FreezeLocale): Say {
        return (key, params = {}) => this.catalog.get(key, params, locale)
    }

    /** The item of the freeze: the one it names updated while it waits, else a new one. Answers the id of the item that waits. */
    async raise(workspaceId: string, freeze: LeadFreeze, locale: FreezeLocale): Promise<string> {
        if (freeze.workItemId !== null && (await this.update(workspaceId, freeze.workItemId, freeze, locale)))
            return freeze.workItemId
        const installation =
            freeze.agentId === null ? null : await this.installations.ofAgent(workspaceId, freeze.agentId)
        const subject =
            freeze.leadId === null
                ? { type: "conversation" as const, id: freeze.conversationId }
                : { type: "lead" as const, id: freeze.leadId }
        const spec: WorkSpec = {
            action: LEAD_FROZEN_ACTION,
            ...(installation === null ? {} : { department: installation.moduleKey }),
            subject_type: subject.type,
            subject_id: subject.id,
            lead_id: freeze.leadId,
            dedupeKey: dedupeKeyOf(freeze),
            seed: { summary: itemSummaryOf(freeze, this.sayIn(locale)), fields: fieldsOf(freeze, this.sayIn(locale)) },
            preset: true,
            forceAsk: "branch_ask",
            // The team is told by the one card of the stopped workflow, which carries these three decisions: no second line.
            ownCard: true,
        }
        const item = await this.engine.runWork({ workspaceId, actor: ACTOR, locale }, spec)
        return item.id
    }

    /** Writes the newest text on the item while it waits for the owner; false when it was decided or is gone. */
    private async update(
        workspaceId: string,
        itemId: string,
        freeze: LeadFreeze,
        locale: FreezeLocale,
    ): Promise<boolean> {
        const [item] = await this.items.findMany([itemId], 1)
        if (item?.workspace_id !== workspaceId || item.status !== "waiting_decision") return false
        await this.items.markStillWaiting(item.id, {
            proposal: {
                ...item.proposal,
                summary: itemSummaryOf(freeze, this.sayIn(locale)),
                fields: fieldsOf(freeze, this.sayIn(locale)),
            },
            missing: item.missing_fields,
            reason: item.reason ?? "branch_ask",
            reasons: item.reasons.flatMap((reason) => reasonOf(reason)),
        })
        return true
    }
}

const REASONS = ["routine", "missing_data", "over_authority", "unclear_outcome", "not_allowed", "branch_ask"] as const

const reasonOf = (reason: string): ReadonlyArray<(typeof REASONS)[number]> => REASONS.filter((each) => each === reason)
