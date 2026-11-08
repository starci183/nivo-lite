import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { ReviewTemplateListingCommand } from "../../application/review-template-listing.command"
import { ListingType } from "./dto/listing.type"
import { ReviewTemplateListingInput } from "./dto/review-template-listing.input"
import { toReviewTemplateListingRequest, toReviewTemplateListingType } from "./review-template-listing.mapper"

@Resolver()
/** GraphQL door of reviewTemplateListing. */
export class ReviewTemplateListingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** A platform reviewer approves or rejects a submitted listing. */
    @Mutation(() => ListingType, { name: "reviewTemplateListing" })
    async reviewTemplateListing(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: ReviewTemplateListingInput,
    ): Promise<ListingType> {
        const result = await this.commandBus.execute(
            new ReviewTemplateListingCommand({ request: toReviewTemplateListingRequest(input), principal }),
        )
        return toReviewTemplateListingType(result)
    }
}
