import type { QueryBus } from "@nestjs/cqrs"
import { Int, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MyWorkInHandQuery } from "../../application/my-work-in-hand.query"

@Resolver()
/** GraphQL door of the work the caller has in hand in a workspace. */
export class MyWorkInHandResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** How many open work items are assigned to the caller's staff row in the workspace the request names. */
    @Query(() => Int, { name: "myWorkInHand" })
    myWorkInHand(@CurrentPrincipal() principal: Principal, @WorkspaceId() workspaceId: string): Promise<number> {
        return this.queryBus.execute(new MyWorkInHandQuery({ request: { workspaceId }, principal }))
    }
}
