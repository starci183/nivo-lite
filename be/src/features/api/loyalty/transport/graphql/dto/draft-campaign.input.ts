import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsObject, IsString, MaxLength, ValidateNested } from "class-validator"
import { LoyaltySegmentInput } from "./loyalty-segment.input"

@InputType()
/** The owner's bounded brief and audience for a queued campaign. */
export class DraftCampaignInput {
    /** Campaign name, empty to use the segment label. */
    @Field()
    @IsString()
    @MaxLength(100)
    name!: string

    /** Target customers. */
    @Field(() => LoyaltySegmentInput)
    @IsObject()
    @ValidateNested()
    @Type(() => LoyaltySegmentInput)
    segment!: LoyaltySegmentInput

    /** Offer in the owner's words. */
    @Field()
    @IsString()
    @MaxLength(400)
    brief!: string
}
