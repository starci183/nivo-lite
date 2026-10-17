import type { CredentialPrincipal } from "@modules/domain/identity"
import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { Credential, CurrentCredentialPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { PublicHiringOfferQuery } from "../../application/public-hiring-offer.query"
import { PublicOfferType } from "./dto/public-offer.type"
import { HiringTokenInput } from "./dto/hiring-token.input"
import { toPublicHiringOfferRequest, toPublicOfferType } from "./hiring-public.mapper"

@Resolver()
/** GraphQL door: read an offer from the candidate's link. */
export class PublicHiringOfferResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Read an offer from the candidate's link. */
    @Credential({ kind: "link-token", workflow: "public-hiring-offer" })
    @RateLimit(RateTier.Strict)
    @Query(() => PublicOfferType, { name: "publicHiringOffer" })
    async publicHiringOffer(
        @Args("input") input: HiringTokenInput,
        @CurrentCredentialPrincipal() credentialPrincipal: CredentialPrincipal,
    ): Promise<PublicOfferType> {
        const result = await this.queryBus.execute(
            new PublicHiringOfferQuery({ request: { ...toPublicHiringOfferRequest(input), credentialPrincipal } }),
        )
        return toPublicOfferType(result)
    }
}
