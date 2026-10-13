import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListInvitesQuery } from "../../application/list-invites.query"
import { PendingInviteType } from "./dto/pending-invite.type"
import { toPendingInvitesType } from "./workspace-invites.mapper"

@Resolver()
/** GraphQL door of the pending invitations of the caller's workspace. */
export class WorkspaceInvitesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the invitations that can still be accepted; owner and manager only. */
    @Query(() => [PendingInviteType], { name: "workspaceInvites" })
    async workspaceInvites(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<PendingInviteType>> {
        const result = await this.queryBus.execute(new ListInvitesQuery({ request: { workspaceId }, principal }))
        return toPendingInvitesType(result)
    }
}
