import { Field, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from "class-validator"
import { Type } from "class-transformer"
import { LoyaltyEarnInput } from "./loyalty-earn.input"
import { LoyaltyTierInput } from "./loyalty-tier.input"
import { LoyaltyExpiryInput } from "./loyalty-expiry.input"
import { LoyaltyBirthdayInput } from "./loyalty-birthday.input"
import { LoyaltyPromoInput } from "./loyalty-promo.input"

@InputType()
/** The bounded loyalty config arguments. */
export class LoyaltyConfigInput {
    /** The earn. */
    @Field(() => LoyaltyEarnInput)
    @ValidateNested()
    @Type(() => LoyaltyEarnInput)
    earn!: LoyaltyEarnInput

    /** The tiers. */
    @Field(() => [LoyaltyTierInput])
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(8)
    @ValidateNested({ each: true })
    @Type(() => LoyaltyTierInput)
    tiers!: ReadonlyArray<LoyaltyTierInput>

    /** The expiry. */
    @Field(() => LoyaltyExpiryInput)
    @ValidateNested()
    @Type(() => LoyaltyExpiryInput)
    expiry!: LoyaltyExpiryInput

    /** The birthday. */
    @Field(() => LoyaltyBirthdayInput)
    @ValidateNested()
    @Type(() => LoyaltyBirthdayInput)
    birthday!: LoyaltyBirthdayInput

    /** The promo. */
    @Field(() => LoyaltyPromoInput)
    @ValidateNested()
    @Type(() => LoyaltyPromoInput)
    promo!: LoyaltyPromoInput
}
