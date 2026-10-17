import type { CredentialPrincipal } from "@modules/domain/identity"
import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Credential, CurrentCredentialPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { RespondHiringOfferCommand } from "../../application/respond-hiring-offer.command"
import { RespondOfferType } from "./dto/respond-offer.type"
import { RespondHiringOfferInput } from "./dto/respond-hiring-offer.input"
import { toRespondHiringOfferRequest, toRespondOfferType } from "./hiring-public.mapper"

@Resolver()
/** GraphQL door: accept or decline an offer from the candidate's link. */
export class RespondHiringOfferResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Accept or decline an offer from the candidate's link. */
    @Credential({ kind: "link-token", workflow: "respond-hiring-offer" })
    @RateLimit(RateTier.Strict)
    @Mutation(() => RespondOfferType, { name: "respondHiringOffer" })
    async respondHiringOffer(
        @Args("input") input: RespondHiringOfferInput,
        @CurrentCredentialPrincipal() credentialPrincipal: CredentialPrincipal,
    ): Promise<RespondOfferType> {
        const result = await this.commandBus.execute(
            new RespondHiringOfferCommand({ request: { ...toRespondHiringOfferRequest(input), credentialPrincipal } }),
        )
        return toRespondOfferType(result)
    }
}
