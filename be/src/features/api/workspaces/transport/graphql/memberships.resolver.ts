import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListMembershipsQuery } from "../../application/list-memberships.query"
import { MembershipType } from "./dto/memberships.type"
import { toMembershipsType } from "./memberships.mapper"

@Resolver()
/** GraphQL door of the workspaces of the caller. */
export class MembershipsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists every workspace the caller belongs to with their membership in each. */
    @Query(() => [MembershipType], { name: "myWorkspaces" })
    async myWorkspaces(@CurrentPrincipal() principal: Principal): Promise<Array<MembershipType>> {
        const result = await this.queryBus.execute(new ListMembershipsQuery({ request: {}, principal }))
        return toMembershipsType(result)
    }
}
