import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReadLeadGenWorkbenchQuery } from "../../application/read-leadgen-workbench.query"
import { LeadGenWorkbenchInput } from "./dto/leadgen-workbench.input"
import { LeadGenWorkbenchType } from "./dto/leadgen-workbench.type"
import { toLeadGenWorkbenchType, toReadLeadGenWorkbenchRequest } from "./read-leadgen-workbench.mapper"

@Resolver()
/** GraphQL door of the Lead Gen workbench. */
export class ReadLeadGenWorkbenchResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads prospects and their sources, comments and Sales handoffs for the active workspace. */
    @Query(() => LeadGenWorkbenchType, { name: "leadGenWorkbench" })
    async leadGenWorkbench(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input", { nullable: true }) input?: LeadGenWorkbenchInput,
    ): Promise<LeadGenWorkbenchType> {
        const result = await this.queryBus.execute(
            new ReadLeadGenWorkbenchQuery({
                principal,
                request: toReadLeadGenWorkbenchRequest(workspaceId, input),
            }),
        )
        return toLeadGenWorkbenchType(result)
    }
}
