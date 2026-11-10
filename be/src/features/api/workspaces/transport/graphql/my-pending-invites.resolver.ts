import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListMyInvitesQuery } from "../../application/list-my-invites.query"
import { InviteForMeType } from "./dto/invite-for-me.type"
import { toInvitesForMeType } from "./my-invites.mapper"

@Resolver()
/** GraphQL door of the invitations addressed to the caller. */
export class MyPendingInvitesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the pending invitations to the caller's signed-in email, newest first. */
    @Query(() => [InviteForMeType], { name: "myPendingInvites" })
    async myPendingInvites(@CurrentPrincipal() principal: Principal): Promise<Array<InviteForMeType>> {
        const result = await this.queryBus.execute(new ListMyInvitesQuery({ request: {}, principal }))
        return toInvitesForMeType(result)
    }
}
