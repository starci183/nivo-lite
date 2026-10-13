import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CancelHiringOfferCommand } from "../../application/cancel-hiring-offer.command"
import { HiringOfferRefInput } from "./dto/hiring-offer-ref.input"
import { toCancelHiringOfferRequest } from "./hiring-offers.mapper"

@Resolver()
/** GraphQL door: cancel an offer. */
export class CancelHiringOfferResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Cancel an offer. */
    @Mutation(() => Boolean, { name: "cancelHiringOffer" })
    async cancelHiringOffer(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: HiringOfferRefInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new CancelHiringOfferCommand({ request: toCancelHiringOfferRequest(workspaceId, input), principal }),
        )
        return true
    }
}
