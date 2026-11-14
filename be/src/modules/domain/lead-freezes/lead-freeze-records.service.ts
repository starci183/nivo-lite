import { Injectable, Optional } from "@nestjs/common"
import { ContactsService, ConversationContactsService } from "@modules/domain/contacts"
import type { EntityManager } from "typeorm"
import type { ContactFreezeStore } from "./contact-freeze-store.port"
import { InjectContactFreezeStore } from "./lead-freezes.decorators"
import { LeadFreezesError, LeadFreezesErrorCode } from "./errors/lead-freezes.error"
import type {
    FreezeSubject,
    FreezeValues,
    LeadFreeze,
    OptionalLeadFreeze,
    OptionalText,
} from "./lead-freezes.contracts"

/** How often a write is tried again after another writer moved the freeze first. */
const WRITE_TRIES = 5

/** The most frozen customers one read of a workspace looks at. */
const FROZEN_PAGE = 100

/** What a write of a freeze answers to build the next values from the freeze as it stands. */
export type FreezeBuild = (freeze: LeadFreeze) => FreezeValues | null

const unreadable = (): LeadFreezesError => new LeadFreezesError({ code: LeadFreezesErrorCode.RecordUnreadable })

@Injectable()
/**
 * The one door to the freezes of people (`public.contact_freezes`, `CONTACT_FREEZE_STORE`), and what a freeze reads of the contacts to
 * know who a wake is about (a conversation's contact, the ids merged into it, its name). Reads are indexed lookups; a write is an
 * update under the version read, read again and rebuilt when another writer moved the freeze first.
 */
export class LeadFreezeRecordsService {
    constructor(
        @InjectContactFreezeStore() private readonly store: ContactFreezeStore,
        @Optional() private readonly conversations?: ConversationContactsService,
        @Optional() private readonly contacts?: ContactsService,
    ) {}

    /** The freeze of a customer by its key, or null. `manager` joins the caller's transaction. */
    byKey(workspaceId: string, key: string, manager?: EntityManager): Promise<OptionalLeadFreeze> {
        return this.store.find(workspaceId, { key }, manager)
    }

    /** The freeze a run froze, or null. */
    byRun(workspaceId: string, runId: string): Promise<OptionalLeadFreeze> {
        return this.store.find(workspaceId, { frozenRunId: runId })
    }

    /** The freeze of a contact, or null. */
    byContact(workspaceId: string, contactId: string): Promise<OptionalLeadFreeze> {
        return this.store.find(workspaceId, { contactId })
    }

    /** One freeze, or null. */
    byId(workspaceId: string, id: string): Promise<OptionalLeadFreeze> {
        return this.store.find(workspaceId, { id })
    }

    /** The customers of a workspace that are frozen or being retried, oldest first, at most one page each. */
    async holding(workspaceId: string): Promise<ReadonlyArray<LeadFreeze>> {
        const pages = await Promise.all(
            (["frozen", "retrying"] as const).map((status) => this.store.inStatus(workspaceId, status, FROZEN_PAGE)),
        )
        return pages.flat()
    }

    /** The freeze of a customer, created with `create` when there is none; the unique key makes a race find the one written first. */
    async ensure(workspaceId: string, subject: FreezeSubject, create: FreezeValues): Promise<LeadFreeze> {
        const made = await this.store.insert(workspaceId, subject, create)
        if (made !== null) return made
        const raced = await this.store.find(workspaceId, { key: subject.key })
        if (raced === null) throw unreadable()
        return raced
    }

    /**
     * Writes what `build` answers for the freeze as it stands, under the version read; when another writer moved it first, it is read and
     * built again. Answers the freeze after the write, or null when `build` answered no write. `manager` joins the caller's transaction.
     */
    patch(workspaceId: string, id: string, build: FreezeBuild, manager?: EntityManager): Promise<OptionalLeadFreeze> {
        return this.patchIn(workspaceId, id, build, WRITE_TRIES, manager)
    }

    private async patchIn(
        workspaceId: string,
        id: string,
        build: FreezeBuild,
        left: number,
        manager: EntityManager | undefined,
    ): Promise<OptionalLeadFreeze> {
        if (left <= 0) throw new LeadFreezesError({ code: LeadFreezesErrorCode.Contended })
        const freeze = await this.store.find(workspaceId, { id }, manager)
        if (freeze === null) throw unreadable()
        const values = build(freeze)
        if (values === null) return null
        const written = await this.store.update(workspaceId, id, freeze.version, values, manager)
        return written ?? this.patchIn(workspaceId, id, build, left - 1, manager)
    }

    /** The contact a conversation's channel identity resolves to, or null. */
    async contactOfConversation(workspaceId: string, conversationId: string): Promise<OptionalText> {
        return (await this.conversations?.contactOf(workspaceId, conversationId)) ?? null
    }

    /** The contact and every id merged into it (a hold written under an old id is found by them); just the id without contacts. */
    async aliasesOf(workspaceId: string, contactId: string): Promise<ReadonlyArray<string>> {
        return (await this.contacts?.aliasesOf(workspaceId, contactId)) ?? [contactId]
    }

    /** The display name of a contact, or null. */
    async nameOfContact(workspaceId: string, contactId: string): Promise<OptionalText> {
        return (await this.contacts?.get(workspaceId, contactId))?.displayName ?? null
    }
}
