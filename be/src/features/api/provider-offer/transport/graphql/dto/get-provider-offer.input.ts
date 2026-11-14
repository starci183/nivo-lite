import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of providerOffer. */
export class GetProviderOfferInput {
    /** The connected account whose provider is documented. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string
}
