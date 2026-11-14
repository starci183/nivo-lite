import { Injectable } from "@nestjs/common"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import type { Locale } from "@modules/platform/i18n"
import { LeadFreezesService } from "./lead-freezes.service"
import type { FreezeOutcome, OptionalFreezeState } from "./lead-freezes.contracts"

/** Which person a page asks about: a contact, or the person of a run. */
export interface FreezeLookup {
    /** The workspace the caller names. */
    readonly workspaceId: string
    /** The contact, when the contacts page asks (a GraphQL input leaves it null when the page sends none). */
    readonly contactId?: string | null | undefined
    /** The run, when the run page asks. */
    readonly runId?: string | undefined
}

/** The owner's answer as a page sends it (kept for the pages that still send it; a hold is answered on its stop). */
export interface FreezeAnswer {
    /** The workspace the caller names. */
    readonly workspaceId: string
    /** The freeze. */
    readonly freezeId: string
    /** `retry`, `take_over` or `skip`. */
    readonly action: string
    /** The language of the page. */
    readonly locale: Locale
}

/** How the owner's answer ended, as the pages read it. */
export interface FreezeAnswered {
    /** `on_stop` while a stop holds the customer, else `not_found`. */
    readonly outcome: FreezeOutcome
}

/** The hold a page reads, with the lead the page asked by (or null). */
export type LeadFreezeRead = NonNullable<OptionalFreezeState> & {
    /** The lead the page asked by, or null when it asked by a contact. */
    readonly leadId: string | null
}

@Injectable()
/**
 * The pages' door to the holds of customers, for an owner or manager only. Reading answers the hold of a contact or of
 * the customer of a run (the run page). A hold is the shadow of a thread run's stop, so it is never answered here: the founder answers
 * the stop (its card on /chat, the run page), and the customer is released when the stop closes. An answer sent to a hold is told
 * `on_stop`; one sent to a freeze that holds nobody is told `not_found`.
 */
export class LeadFreezeDoorService {
    constructor(
        private readonly access: AgentWorkAccessService,
        private readonly freezes: LeadFreezesService,
    ) {}

    /** Whether the customer of a contact or of a run waits for the owner; null when nothing holds them or the page names neither. */
    async read(principalId: string, lookup: FreezeLookup): Promise<OptionalFreezeState> {
        await this.access.manager(principalId, lookup.workspaceId)
        if (lookup.runId !== undefined && lookup.runId !== "")
            return this.freezes.stateOfRun(lookup.workspaceId, lookup.runId)
        const contactId = lookup.contactId
        if (contactId === undefined || contactId === null || contactId === "") return null
        return this.freezes.stateOfContact(lookup.workspaceId, contactId)
    }

    /** The hold `read` finds, carrying the lead the page asked by (the lead page); null when nothing holds the customer. */
    async readFor(principalId: string, lookup: FreezeLookup & { readonly leadId?: string | undefined }): Promise<LeadFreezeRead | null> {
        const state = await this.read(principalId, lookup)
        return state === null ? null : { ...state, leadId: lookup.leadId ?? null }
    }

    /** Answers where the hold stands: `on_stop` (answer the stop), else `not_found`; nothing moves here. */
    async answer(principalId: string, answer: FreezeAnswer): Promise<FreezeAnswered> {
        await this.access.manager(principalId, answer.workspaceId)
        const state = await this.freezes.stateOf(answer.workspaceId, answer.freezeId)
        return { outcome: state?.onStop === true ? "on_stop" : "not_found" }
    }
}
