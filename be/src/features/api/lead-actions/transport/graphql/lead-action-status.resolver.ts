import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LeadActionStatusQuery } from "../../application/lead-action-status.query"
import { LeadActionStatusInput } from "./dto/lead-action-status.input"
import { LeadActionStatusType } from "./dto/lead-action-status.type"
import { toLeadActionStatusRequest, toLeadActionStatusType } from "./lead-action-status.mapper"

@Resolver()
/** GraphQL door for polling the asynchronous lead action's state. */
export class LeadActionStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads one action's progress after proving membership of its workspace. */
    @Query(() => LeadActionStatusType, { name: "leadActionStatus" })
    async leadActionStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LeadActionStatusInput,
    ): Promise<LeadActionStatusType> {
        const result = await this.queryBus.execute(
            new LeadActionStatusQuery({ request: toLeadActionStatusRequest(workspaceId, input), principal }),
        )
        return toLeadActionStatusType(result)
    }
}
