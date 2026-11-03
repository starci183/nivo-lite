import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** A paid listing to order. */
export class OrderTemplateListingInput {
    /** The listing. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    listingId!: string
}
