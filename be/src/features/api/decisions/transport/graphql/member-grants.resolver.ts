import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListMemberGrantsQuery } from "../../application/list-member-grants.query"
import { MemberGrantType } from "./dto/member-grant.type"
import { MemberGrantsInput } from "./dto/member-grants.input"
import { toListMemberGrantsRequest, toMemberGrantsType } from "./decisions.mapper"

@Resolver()
/** GraphQL door of what each member may approve. */
export class MemberGrantsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the approval limits of one action; owner and manager only. */
    @Query(() => [MemberGrantType], { name: "memberGrants" })
    async memberGrants(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MemberGrantsInput,
    ): Promise<Array<MemberGrantType>> {
        const result = await this.queryBus.execute(
            new ListMemberGrantsQuery({ request: toListMemberGrantsRequest(workspaceId, input), principal }),
        )
        return toMemberGrantsType(result)
    }
}
