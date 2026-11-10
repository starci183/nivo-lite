import { Injectable } from "@nestjs/common"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { WorkDecisionService } from "@modules/domain/decisions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { Locale } from "@modules/platform/i18n"
import { LeadFreezesService } from "./lead-freezes.service"
import type { FreezeOutcome, OptionalFreezeState } from "./lead-freezes.contracts"

/** The owner's three answers, as the pages send them. */
const ANSWERS: ReadonlySet<string> = new Set(["retry", "take_over", "skip"])

/** Which customer a page asks about: a lead, or the customer of a run. */
export interface FreezeLookup {
    /** The workspace the caller names. */
    readonly workspaceId: string
    /** The lead, when the lead page asks. */
    readonly leadId?: string | undefined
    /** The run, when the run page asks. */
    readonly runId?: string | undefined
}

/** The owner's answer as a page sends it. */
export interface FreezeAnswer {
    /** The workspace the caller names. */
    readonly workspaceId: string
    /** The freeze. */
    readonly freezeId: string
    /** `retry`, `take_over` or `skip`. */
    readonly action: string
    /** The language of the decision log. */
    readonly locale: Locale
}

/** How the owner's answer ended, as the pages read it. */
export interface FreezeAnswered {
    /** The outcome. */
    readonly outcome: FreezeOutcome
}

@Injectable()
/**
 * The pages' door to the freezes, for an owner or manager only. Reading answers the freeze of a lead (the Inputs page) or of the customer
 * of a run (the run page). Answering retries or skips through the freeze's own work item, as the inbox decides it (approving retries the
 * run, rejecting skips the turn), so the item, the decision log and the run move together; taking over hands the conversation to the
 * caller by name and keeps the customer frozen.
 */
export class LeadFreezeDoorService {
    constructor(
        private readonly access: AgentWorkAccessService,
        private readonly members: WorkspaceMembersService,
        private readonly freezes: LeadFreezesService,
        private readonly work: WorkDecisionService,
    ) {}

    /** Whether the customer of a lead or of a run waits for the owner; null when nothing holds them or the page names neither. */
    async read(principalId: string, lookup: FreezeLookup): Promise<OptionalFreezeState> {
        await this.access.manager(principalId, lookup.workspaceId)
        if (lookup.runId !== undefined && lookup.runId !== "")
            return this.freezes.stateOfRun(lookup.workspaceId, lookup.runId)
        if (lookup.leadId === undefined || lookup.leadId === "") return null
        return this.freezes.stateOfLead(lookup.workspaceId, lookup.leadId)
    }

    /** Sends the owner's answer and answers how it ended, as the pages read it. */
    async answer(principalId: string, answer: FreezeAnswer): Promise<FreezeAnswered> {
        return { outcome: await this.outcomeOf(principalId, answer) }
    }

    private async outcomeOf(principalId: string, answer: FreezeAnswer): Promise<FreezeOutcome> {
        await this.access.manager(principalId, answer.workspaceId)
        const state = await this.freezes.stateOf(answer.workspaceId, answer.freezeId)
        if (state === null || !ANSWERS.has(answer.action)) return "not_frozen"
        if (answer.action === "take_over") {
            const member = await this.members.require(principalId, answer.workspaceId)
            return this.freezes.takeOver(answer.workspaceId, state.id, member.displayName)
        }
        if (state.workItemId === null) return "not_frozen"
        const retry = answer.action === "retry"
        await this.work.decide(principalId, answer.workspaceId, {
            workItemId: state.workItemId,
            decision: retry ? "approved" : "rejected",
            locale: answer.locale,
        })
        const after = await this.freezes.stateOf(answer.workspaceId, state.id)
        if (after === null) return retry ? "released" : "skipped"
        return after.status === "retrying" ? "retrying" : "still_frozen"
    }
}
