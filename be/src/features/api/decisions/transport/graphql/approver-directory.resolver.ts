import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListApproversQuery } from "../../application/list-approvers.query"
import { ApproverMemberType } from "./dto/approver-member.type"
import { toApproverMembersType, toListApproversRequest } from "./decisions.mapper"

@Resolver()
/** GraphQL door of the people an approver group can name. */
export class ApproverDirectoryResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists everyone of the workspace with the rooms they sit in; owner and manager only. */
    @Query(() => [ApproverMemberType], { name: "approverDirectory" })
    async approverDirectory(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<ApproverMemberType>> {
        const result = await this.queryBus.execute(
            new ListApproversQuery({ request: toListApproversRequest(workspaceId), principal }),
        )
        return toApproverMembersType(result)
    }
}
