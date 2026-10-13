import { Field, InputType, ID } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded loyalty member arguments. */
export class LoyaltyMemberInput {
    /** The customer id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    customerId!: string
}
