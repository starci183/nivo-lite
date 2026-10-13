import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListMembersQuery } from "../../application/list-members.query"
import { MemberListingType } from "./dto/member-listing.type"
import { toMemberListingsType } from "./workspace-members.mapper"

@Resolver()
/** GraphQL door of the members of the caller's workspace. */
export class WorkspaceMembersResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists everyone in the caller's workspace, owners first; emails and sign-ins are blank for staff callers. */
    @Query(() => [MemberListingType], { name: "workspaceMembers" })
    async workspaceMembers(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<MemberListingType>> {
        const result = await this.queryBus.execute(new ListMembersQuery({ request: { workspaceId }, principal }))
        return toMemberListingsType(result)
    }
}
