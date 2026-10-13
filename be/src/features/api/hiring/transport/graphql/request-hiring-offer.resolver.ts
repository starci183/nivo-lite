import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestHiringOfferCommand } from "../../application/request-hiring-offer.command"
import { HiringOutcomeType } from "./dto/hiring-outcome.type"
import { RequestHiringOfferInput } from "./dto/request-hiring-offer.input"
import { toRequestHiringOfferRequest, toHiringOutcomeType } from "./hiring-offers.mapper"

@Resolver()
/** GraphQL door: draft an offer for a candidate and ask for approval. */
export class RequestHiringOfferResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Draft an offer for a candidate and ask for approval. */
    @Mutation(() => HiringOutcomeType, { name: "requestHiringOffer" })
    async requestHiringOffer(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestHiringOfferInput,
    ): Promise<HiringOutcomeType> {
        const result = await this.commandBus.execute(
            new RequestHiringOfferCommand({ request: toRequestHiringOfferRequest(workspaceId, input), principal }),
        )
        return toHiringOutcomeType(result)
    }
}
