import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TemplateUpdateOffersQuery } from "../../application/template-update-offers.query"
import { UpdateOfferType } from "./dto/update-offer.type"
import { toTemplateUpdateOffersRequest, toTemplateUpdateOffersType } from "./template-update-offers.mapper"

@Resolver()
/** GraphQL door of templateUpdateOffers. */
export class TemplateUpdateOffersResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the newer versions of templates offered to the agents of this workspace, branch by branch. */
    @Query(() => [UpdateOfferType], { name: "templateUpdateOffers" })
    async templateUpdateOffers(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<UpdateOfferType>> {
        const result = await this.queryBus.execute(
            new TemplateUpdateOffersQuery({ request: toTemplateUpdateOffersRequest(workspaceId), principal }),
        )
        return toTemplateUpdateOffersType(result)
    }
}
