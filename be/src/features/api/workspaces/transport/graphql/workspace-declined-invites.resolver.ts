import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { ListDeclinedInvitesQuery } from "../../application/list-declined-invites.query"
import { toDeclinedInvitesType } from "./declined-invites.mapper"
import { DeclinedInviteType } from "./dto/declined-invite.type"

@Resolver()
/** GraphQL door of the invitations of a workspace that were declined. */
export class WorkspaceDeclinedInvitesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the invitations of the workspace declined in the last 30 days, newest first; owner and manager only. */
    @Query(() => [DeclinedInviteType], { name: "workspaceDeclinedInvites" })
    async workspaceDeclinedInvites(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<DeclinedInviteType>> {
        const result = await this.queryBus.execute(
            new ListDeclinedInvitesQuery({ request: { workspaceId }, principal }),
        )
        return toDeclinedInvitesType(result)
    }
}
