import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetMemberDetailQuery } from "../../application/get-member-detail.query"
import { toLoyaltyMemberRequest, toLoyaltyMemberType } from "./loyalty-member.mapper"
import { LoyaltyMemberInput } from "./dto/loyalty-member.input"
import { LoyaltyMemberDetailType } from "./dto/loyalty-member-detail.type"

@Resolver()
/** The GraphQL door for loyalty member. */
export class LoyaltyMemberResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Runs loyalty member for the selected workspace. */
    @Query(() => LoyaltyMemberDetailType, { name: "loyaltyMember" })
    async loyaltyMember(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LoyaltyMemberInput,
    ): Promise<LoyaltyMemberDetailType> {
        const result = await this.queryBus.execute(
            new GetMemberDetailQuery({ request: toLoyaltyMemberRequest(input, workspaceId), principal }),
        )
        return toLoyaltyMemberType(result)
    }
}
