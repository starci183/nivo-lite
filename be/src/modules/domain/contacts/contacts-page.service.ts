import { Injectable } from "@nestjs/common"
// The door file, not the barrel: the barrel reaches back to this capability (workspaces, installed-plugins, trigger-specs, provider-triggers, contacts), so a barrel import leaves the seat check undefined at decoration.
import { AgentWorkAccessService } from "@modules/domain/agent-work/agent-work-access.service"
import type {
    ContactDetailView,
    ContactsPageView,
    ContactView,
    DeleteContactRequest,
    ForgetContactMemoryRequest,
    LinkContactIdentityRequest,
    LinkContactIdentityView,
    MergeContactsRequest,
    ReadContactRequest,
    ReadContactsRequest,
    UnlinkContactIdentityRequest,
    UpdateContactRequest,
} from "./contacts-page.contracts"
import { linkKindOf } from "./contact-link-kind.policy"
import { CONTACTS_PAGE_MAX, ContactsService } from "./contacts.service"
import type { ContactActor, ContactWithIdentities } from "./contacts.contracts"
import { ContactsError, ContactsErrorCode } from "./errors/contacts.error"

/** The page size of the list when the page names none. */
const PAGE_SIZE = 30

/** The cursor of a page: the last row's creation time and id, as base64url text. */
const cursorOf = (contact: ContactView): string => Buffer.from(`${contact.createdAt}|${contact.id}`).toString("base64url")

/** The position a cursor names, or null for none or one of another shape. */
const afterOf = (cursor: string | undefined): { readonly createdAt: string; readonly id: string } | null => {
    if (cursor === undefined || cursor === "") return null
    const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|")
    return createdAt === undefined || id === undefined || createdAt === "" || id === "" ? null : { createdAt, id }
}

const viewOf = (contact: ContactWithIdentities): ContactView => ({
    id: contact.id,
    displayName: contact.displayName,
    tags: [...contact.tags],
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    identities: contact.identities.map((one) => ({
        id: one.id,
        kind: one.kind,
        provider: one.provider,
        account: one.account,
        value: one.value,
        verified: one.verified,
        verifiedBy: one.verifiedBy,
        source: one.source,
        joinedBy: one.joinedBy,
        at: one.at,
    })),
})

const missing = (): ContactsError => new ContactsError({ code: ContactsErrorCode.ContactMissing })

@Injectable()
/**
 * The /contacts page's door to the engine's contacts (`nivo.api.nivo.contact.*`), for an owner or a manager of the workspace (an erasure:
 * the owner). Every merge, link and erasure is a person's decision and is audited with who made it. The engine draws no module meaning
 * here: a module's own records about the person mount on the page as its blocks.
 */
export class ContactsPageService {
    constructor(
        private readonly access: AgentWorkAccessService,
        private readonly contacts: ContactsService,
    ) {}

    /** `nivo.api.nivo.contact.list`: a page of people, or the people a search finds (the list takes the search input). */
    async list(principalId: string, request: ReadContactsRequest): Promise<ContactsPageView> {
        await this.access.manager(principalId, request.workspaceId)
        const size = Math.max(1, Math.min(CONTACTS_PAGE_MAX, request.size ?? PAGE_SIZE))
        const search = request.search?.trim() ?? ""
        if (search !== "") {
            const found = await this.contacts.search(request.workspaceId, search, size)
            return { contacts: found.map((contact) => viewOf(contact)), next: null }
        }
        const page = (await this.contacts.list(request.workspaceId, afterOf(request.cursor), size)).map((contact) => viewOf(contact))
        const last = page.at(-1)
        return { contacts: page, next: page.length < size || last === undefined ? null : cursorOf(last) }
    }

    /**
     * `nivo.api.nivo.contact.get` (it carries the contact's memory): one contact with what the agents remember (masked for display) and the "maybe the same person" suggestions.
     */
    async detail(principalId: string, request: ReadContactRequest): Promise<ContactDetailView | null> {
        await this.access.manager(principalId, request.workspaceId)
        const contact = await this.contacts.get(request.workspaceId, request.id)
        if (contact === null) return null
        const [memory, suggestions] = await Promise.all([
            this.contacts.memoryOf(request.workspaceId, contact.id, "display"),
            this.contacts.suggestionsOf(request.workspaceId, contact.id),
        ])
        const others = await Promise.all(suggestions.map((one) => this.contacts.get(request.workspaceId, one.contactId)))
        return {
            contact: viewOf(contact),
            memory: {
                facts: Object.entries(memory.facts).map(([name, value]) => ({ name, value: JSON.stringify(value) })),
                notes: memory.notes.map((note) => ({ ...note, output: JSON.stringify(note.output) })),
            },
            suggestions: suggestions.map((one, at) => ({
                contactId: one.contactId,
                displayName: others[at]?.displayName ?? null,
                why: one.why,
                identityKind: one.identity?.kind ?? null,
                identityValue: one.identity?.value ?? null,
            })),
        }
    }

    /** `nivo.api.nivo.contact.update`: the display name and / or the tags. */
    async update(principalId: string, request: UpdateContactRequest): Promise<ContactView> {
        const by = await this.memberOf(principalId, request.workspaceId)
        const outcome = await this.contacts.update(
            request.workspaceId,
            request.id,
            {
                ...(request.displayName === undefined ? {} : { displayName: request.displayName }),
                ...(request.tags === undefined ? {} : { tags: request.tags }),
            },
            by,
        )
        if (outcome.kind === "refused") throw missing()
        return this.viewOfId(request.workspaceId, outcome.contactId)
    }

    /**
     * `nivo.api.nivo.contact.identity.link`: an identity a person links is verified by that person (`member`); a verified phone or mail
     * another contact holds verified makes them one person (they merge, the older survives).
     */
    async link(principalId: string, request: LinkContactIdentityRequest): Promise<LinkContactIdentityView> {
        const by = await this.memberOf(principalId, request.workspaceId)
        const outcome = await this.contacts.linkIdentity(
            request.workspaceId,
            request.contactId,
            {
                kind: linkKindOf(request.kind),
                value: request.value,
                proof: "member",
                ...(request.account === undefined ? {} : { account: request.account }),
            },
            by,
        )
        if (outcome.kind === "refused") {
            if (outcome.reason === "contact_missing") throw missing()
            throw new ContactsError({
                code: outcome.reason === "identity_taken" ? ContactsErrorCode.IdentityTaken : ContactsErrorCode.IdentityInvalid,
            })
        }
        return { outcome: outcome.kind, contactId: outcome.kind === "merged" ? outcome.contactId : request.contactId }
    }

    /** `nivo.api.nivo.contact.identity.unlink`: a person takes one identity away. */
    async unlink(principalId: string, request: UnlinkContactIdentityRequest): Promise<ContactView> {
        const by = await this.memberOf(principalId, request.workspaceId)
        const outcome = await this.contacts.unlinkIdentity(request.workspaceId, request.contactId, request.identityId, by)
        if (outcome.kind === "refused") {
            throw outcome.reason === "contact_missing" ? missing() : new ContactsError({ code: ContactsErrorCode.IdentityMissing })
        }
        return this.viewOfId(request.workspaceId, request.contactId)
    }

    /** `nivo.api.nivo.contact.merge`: a person decides two contacts are one (`member_approved`). */
    async merge(principalId: string, request: MergeContactsRequest): Promise<ContactView> {
        const by = await this.memberOf(principalId, request.workspaceId)
        const outcome = await this.contacts.merge(request.workspaceId, { into: request.intoContactId, from: request.fromContactId, by })
        if (outcome.kind === "refused") {
            throw outcome.reason === "same_contact" ? new ContactsError({ code: ContactsErrorCode.SameContact }) : missing()
        }
        return this.viewOfId(request.workspaceId, outcome.contactId)
    }

    /** `nivo.api.nivo.contact.memory.forget`: the agents forget the named facts; answers the names that were held. */
    async forget(principalId: string, request: ForgetContactMemoryRequest): Promise<ReadonlyArray<string>> {
        const by = await this.memberOf(principalId, request.workspaceId)
        const outcome = await this.contacts.forget(request.workspaceId, request.contactId, request.facts, by)
        if (outcome.kind === "refused") throw missing()
        return outcome.facts
    }

    /** `nivo.api.nivo.contact.delete`: the owner deletes a contact SOFTLY (R31): the contact and everything of it stay in the database and every read leaves them out. */
    async delete(principalId: string, request: DeleteContactRequest): Promise<boolean> {
        const memberId = await this.access.owner(principalId, request.workspaceId)
        const outcome = await this.contacts.delete(request.workspaceId, request.id, { kind: "member", memberId })
        if (outcome.kind === "refused") {
            throw outcome.reason === "records_blocked" ? new ContactsError({ code: ContactsErrorCode.RecordsBlocked }) : missing()
        }
        return true
    }

    /** The member who acts, after the seat check (an owner or a manager). */
    private async memberOf(principalId: string, workspaceId: string): Promise<ContactActor> {
        return { kind: "member", memberId: await this.access.manager(principalId, workspaceId) }
    }

    private async viewOfId(workspaceId: string, contactId: string): Promise<ContactView> {
        const contact = await this.contacts.get(workspaceId, contactId)
        if (contact === null) throw missing()
        return viewOf(contact)
    }
}
