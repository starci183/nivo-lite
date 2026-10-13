import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListCommandCandidatesQuery } from "../../application/list-command-candidates.query"
import { OfficeCandidateType } from "./dto/office-candidate.type"
import { toOfficeCandidatesType, toWorkspaceRequest } from "./office.mapper"

@Resolver()
/** GraphQL door of the command cards of the Office composer. */
export class OfficeCommandCandidatesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the command cards of the workspace. */
    @Query(() => [OfficeCandidateType], { name: "officeCommandCandidates" })
    async officeCommandCandidates(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<OfficeCandidateType>> {
        const result = await this.queryBus.execute(
            new ListCommandCandidatesQuery({ request: toWorkspaceRequest(workspaceId), principal }),
        )
        return toOfficeCandidatesType(result)
    }
}
