import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LeadWaitQuery } from "../../application/lead-wait.query"
import { toLeadWaitRequest, toLeadWaitType } from "./lead-wait.mapper"
import { LeadWaitInput } from "./dto/lead-wait.input"
import { LeadWaitType } from "./dto/lead-wait.type"

@Resolver()
/** GraphQL read door for leadWait. */
export class LeadWaitResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads leadWait from the caller's selected workspace. */
    @Query(() => LeadWaitType, { name: "leadWait" })
    async leadWait(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LeadWaitInput,
    ): Promise<LeadWaitType> {
        const result = await this.queryBus.execute(
            new LeadWaitQuery({ request: toLeadWaitRequest(workspaceId, input), principal }),
        )
        return toLeadWaitType(result)
    }
}
