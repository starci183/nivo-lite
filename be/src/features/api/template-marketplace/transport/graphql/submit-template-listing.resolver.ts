import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SubmitTemplateListingCommand } from "../../application/submit-template-listing.command"
import { ListingType } from "./dto/listing.type"
import { SubmitTemplateListingInput } from "./dto/submit-template-listing.input"
import { toSubmitTemplateListingRequest, toSubmitTemplateListingType } from "./submit-template-listing.mapper"

@Resolver()
/** GraphQL door of submitTemplateListing. */
export class SubmitTemplateListingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Offers a saved version of a template of the caller on the marketplace; the automated checks run at once. */
    @Mutation(() => ListingType, { name: "submitTemplateListing" })
    async submitTemplateListing(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: SubmitTemplateListingInput,
    ): Promise<ListingType> {
        const result = await this.commandBus.execute(
            new SubmitTemplateListingCommand({ request: toSubmitTemplateListingRequest(input), principal }),
        )
        return toSubmitTemplateListingType(result)
    }
}
