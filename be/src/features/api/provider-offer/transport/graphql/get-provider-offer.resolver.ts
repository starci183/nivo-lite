import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetProviderOfferQuery } from "../../application/get-provider-offer.query"
import { GetProviderOfferInput } from "./dto/get-provider-offer.input"
import { ProviderOfferType } from "./dto/get-provider-offer.type"
import { toGetProviderOfferRequest, toProviderOfferType } from "./get-provider-offer.mapper"

@Resolver()
/** GraphQL door of providerOffer. */
export class GetProviderOfferResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** What the provider of a connected account offers at its three levels: documentation from the registries, no live datum. */
    @Query(() => ProviderOfferType, { name: "providerOffer" })
    async providerOffer(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetProviderOfferInput,
    ): Promise<ProviderOfferType> {
        const result = await this.queryBus.execute(
            new GetProviderOfferQuery({ request: toGetProviderOfferRequest(workspaceId, input), principal }),
        )
        return toProviderOfferType(result)
    }
}
