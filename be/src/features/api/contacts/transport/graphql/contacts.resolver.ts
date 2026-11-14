import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { AcceptedLocale, type Locale } from "@modules/platform/i18n"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import type { ContactModuleAgentView } from "@modules/domain/workbench-door"
import type { ContactDetailView, ContactsPageView, ContactView, LinkContactIdentityView } from "@modules/domain/contacts"
import {
    DeleteContactCommand,
    ForgetContactMemoryCommand,
    LinkContactIdentityCommand,
    MergeContactsCommand,
    UnlinkContactIdentityCommand,
    UpdateContactCommand,
} from "../../application/contacts.commands"
import type { CustomerLine, LinePage } from "@modules/domain/customer-routes"
import { ContactModuleBlocksQuery, ReadContactQuery, ReadContactsQuery, ReadCustomerMessagesQuery } from "../../application/contacts.queries"
import {
    ContactInput,
    ContactModuleBlocksInput,
    ContactsInput,
    CustomerMessagesInput,
    DeleteContactInput,
    ForgetContactMemoryInput,
    LinkContactIdentityInput,
    MergeContactsInput,
    UnlinkContactIdentityInput,
    UpdateContactInput,
} from "./dto/contacts.input"
import {
    ContactDetailType,
    ContactModuleAgentType,
    ContactsPageType,
    ContactType,
    CustomerMessagePageType,
    type CustomerMessageType,
    LinkContactIdentityType,
} from "./dto/contacts.type"

/** One line as the wire carries it: the order snapshot as JSON text, a missing caption as null. */
const customerMessageOf = (line: CustomerLine): CustomerMessageType => ({
    id: line.id,
    routeId: line.routeId,
    contactId: line.contactId,
    direction: line.direction,
    text: line.text,
    saidAt: line.saidAt,
    files: line.files.map((file) => ({ url: file.url, name: file.name, contentType: file.contentType, caption: file.caption ?? null })),
    orderJson: line.order === null ? null : JSON.stringify(line.order),
    agentId: line.agentId,
    memberId: line.memberId,
    state: line.state,
    reason: line.reason,
    channel: line.channel,
    accountId: line.accountId,
    deliveredAt: line.deliveredAt,
})

@Resolver()
/** GraphQL door of the /contacts page: the engine's contacts, read and decided on by a person (`nivo.api.nivo.contact.*`). */
export class ContactsResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** `nivo.api.nivo.contact.list`: a page of people, or the people a search finds (the list takes the search input). */
    @Query(() => ContactsPageType, { name: "contacts" })
    async contacts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ContactsInput,
    ): Promise<ContactsPageView> {
        return this.queryBus.execute(
            new ReadContactsQuery({
                request: { workspaceId, search: input.search, cursor: input.cursor, size: input.size },
                principal,
            }),
        )
    }

    /** `nivo.api.nivo.contact.get` (it carries the contact's memory): one contact; null when the workspace holds none. */
    @Query(() => ContactDetailType, { name: "contact", nullable: true })
    async contact(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ContactInput,
    ): Promise<ContactDetailView | null> {
        return this.queryBus.execute(new ReadContactQuery({ request: { workspaceId, id: input.id }, principal }))
    }

    /** `nivo.api.nivo.contact.block.list`: what each installed agent's module knows about the person (the detail's module blocks). */
    @Query(() => [ContactModuleAgentType], { name: "contactModuleBlocks" })
    async contactModuleBlocks(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: ContactModuleBlocksInput,
    ): Promise<Array<ContactModuleAgentView>> {
        return [...(await this.queryBus.execute(new ContactModuleBlocksQuery({ request: { workspaceId, contactId: input.contactId, locale }, principal })))]
    }

    /** `nivo.api.nivo.customer.message.list`: the conversation on one route, both directions, newest first (owner ruling R26). */
    @Query(() => CustomerMessagePageType, { name: "customerMessages" })
    async customerMessages(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CustomerMessagesInput,
    ): Promise<CustomerMessagePageType> {
        const page: LinePage = await this.queryBus.execute(
            new ReadCustomerMessagesQuery({
                request: { workspaceId, routeId: input.routeId, after: input.after, since: input.since, limit: input.limit },
                principal,
            }),
        )
        return { rows: page.rows.map((line) => customerMessageOf(line)), next: page.next }
    }

    /** `nivo.api.nivo.contact.update`: the display name and / or the tags. */
    @Mutation(() => ContactType, { name: "updateContact" })
    async updateContact(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateContactInput,
    ): Promise<ContactView> {
        return this.commandBus.execute(
            new UpdateContactCommand({
                request: { workspaceId, id: input.id, displayName: input.displayName, tags: input.tags },
                principal,
            }),
        )
    }

    /** `nivo.api.nivo.contact.identity.link`: a person links (and so verifies) an identity; an exact verified match merges. */
    @Mutation(() => LinkContactIdentityType, { name: "linkContactIdentity" })
    async linkContactIdentity(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LinkContactIdentityInput,
    ): Promise<LinkContactIdentityView> {
        return this.commandBus.execute(
            new LinkContactIdentityCommand({
                request: { workspaceId, contactId: input.contactId, kind: input.kind, value: input.value, account: input.account },
                principal,
            }),
        )
    }

    /** `nivo.api.nivo.contact.identity.unlink`: a person takes one identity away. */
    @Mutation(() => ContactType, { name: "unlinkContactIdentity" })
    async unlinkContactIdentity(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UnlinkContactIdentityInput,
    ): Promise<ContactView> {
        return this.commandBus.execute(
            new UnlinkContactIdentityCommand({
                request: { workspaceId, contactId: input.contactId, identityId: input.identityId },
                principal,
            }),
        )
    }

    /** `nivo.api.nivo.contact.merge`: a person decides two contacts are one. */
    @Mutation(() => ContactType, { name: "mergeContacts" })
    async mergeContacts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MergeContactsInput,
    ): Promise<ContactView> {
        return this.commandBus.execute(
            new MergeContactsCommand({
                request: { workspaceId, intoContactId: input.intoContactId, fromContactId: input.fromContactId },
                principal,
            }),
        )
    }

    /** `nivo.api.nivo.contact.memory.forget`: the agents forget the named facts; answers the names that were held. */
    @Mutation(() => [String], { name: "forgetContactMemory" })
    async forgetContactMemory(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ForgetContactMemoryInput,
    ): Promise<ReadonlyArray<string>> {
        return this.commandBus.execute(
            new ForgetContactMemoryCommand({ request: { workspaceId, contactId: input.contactId, facts: input.facts }, principal }),
        )
    }

    /** `nivo.api.nivo.contact.delete`: the owner deletes a contact softly (R31): it and its identities, memory, routes and customer lines stay and every read leaves them out; the raw account data stays. */
    @Mutation(() => Boolean, { name: "deleteContact" })
    async deleteContact(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DeleteContactInput,
    ): Promise<boolean> {
        return this.commandBus.execute(new DeleteContactCommand({ request: { workspaceId, id: input.id }, principal }))
    }
}
