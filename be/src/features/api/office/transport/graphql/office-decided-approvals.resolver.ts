import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListDecidedApprovalsQuery } from "../../application/list-decided-approvals.query"
import { OfficeApprovalType } from "./dto/office-approval.type"
import { toOfficeApprovalsType, toWorkspaceRequest } from "./office.mapper"

@Resolver()
/** GraphQL door of the approval cards decided most recently. */
export class OfficeDecidedApprovalsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the approval cards decided most recently. */
    @Query(() => [OfficeApprovalType], { name: "officeDecidedApprovals" })
    async officeDecidedApprovals(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<OfficeApprovalType>> {
        const result = await this.queryBus.execute(
            new ListDecidedApprovalsQuery({ request: toWorkspaceRequest(workspaceId), principal }),
        )
        return toOfficeApprovalsType(result)
    }
}
