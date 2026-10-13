import { Field, InputType } from "@nestjs/graphql"
import { ValidateNested } from "class-validator"
import { Type } from "class-transformer"
import { LoyaltySegmentInput } from "./loyalty-segment.input"

@InputType()
/** The bounded preview loyalty segment arguments. */
export class PreviewLoyaltySegmentInput {
    /** The segment. */
    @Field(() => LoyaltySegmentInput)
    @ValidateNested()
    @Type(() => LoyaltySegmentInput)
    segment!: LoyaltySegmentInput
}
