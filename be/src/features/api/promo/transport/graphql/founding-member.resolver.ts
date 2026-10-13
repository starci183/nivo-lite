import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { FoundingMemberQuery } from "../../application/founding-member.query"
import { toFoundingMemberRequest, toFoundingMemberType } from "./founding-member.mapper"

@Resolver()
/** GraphQL read door for foundingMember. */
export class FoundingMemberResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads foundingMember from the caller's selected workspace. */
    @Query(() => Boolean, { name: "foundingMember" })
    async foundingMember(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<boolean> {
        const result = await this.queryBus.execute(
            new FoundingMemberQuery({ request: toFoundingMemberRequest(workspaceId), principal }),
        )
        return toFoundingMemberType(result)
    }
}
