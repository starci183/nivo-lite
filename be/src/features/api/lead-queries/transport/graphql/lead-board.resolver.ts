import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LeadBoardQuery } from "../../application/lead-board.query"
import { LeadBoardType } from "./dto/lead-board.type"
import { toLeadBoardRequest, toLeadBoardType } from "./lead-board.mapper"

@Resolver()
/** The GraphQL door of the lead board. */
export class LeadBoardResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists recent leads with their oldest open follow-up. */
    @Query(() => [LeadBoardType], { name: "leadBoard" })
    async leadBoard(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<LeadBoardType>> {
        const result = await this.queryBus.execute(
            new LeadBoardQuery({ request: toLeadBoardRequest(workspaceId), principal }),
        )
        return toLeadBoardType(result)
    }
}
