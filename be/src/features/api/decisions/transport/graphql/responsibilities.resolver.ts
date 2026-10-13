import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListResponsibilitiesQuery } from "../../application/list-responsibilities.query"
import { ResponsibilityListingType } from "./dto/responsibility-listing.type"
import { toListResponsibilitiesRequest, toResponsibilityListingsType } from "./decisions.mapper"

@Resolver()
/** GraphQL door of the responsibilities journal. */
export class ResponsibilitiesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the responsibilities with their customer, open ones first. */
    @Query(() => [ResponsibilityListingType], { name: "responsibilities" })
    async responsibilities(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<ResponsibilityListingType>> {
        const result = await this.queryBus.execute(
            new ListResponsibilitiesQuery({ request: toListResponsibilitiesRequest(workspaceId), principal }),
        )
        return toResponsibilityListingsType(result)
    }
}
