import type { QueryBus } from "@nestjs/cqrs"
import { Parent, ResolveField, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import type { ContactDetailView } from "@modules/domain/contacts"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import type { ContactRouteView } from "../../application/contact-conversation.contracts"
import { ReadContactRoutesQuery } from "../../application/contacts.queries"
import { ContactDetailType, ContactRouteType } from "./dto/contacts.type"

@Resolver(() => ContactDetailType)
/**
 * The fields of the contact read that need more than the contact: its routes (`contact.routes`). Resolved only when the page selects
 * them, with the seat check of the page, so a list that never asks pays nothing.
 */
export class ContactDetailResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The routes of the contact: one per account of each channel the person is reached on, with the activity, the workbench and the hold. */
    @ResolveField(() => [ContactRouteType], { name: "routes" })
    async routes(
        @Parent() detail: ContactDetailView,
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ReadonlyArray<ContactRouteView>> {
        return this.queryBus.execute(new ReadContactRoutesQuery({ request: { workspaceId, contactId: detail.contact.id }, principal }))
    }
}
