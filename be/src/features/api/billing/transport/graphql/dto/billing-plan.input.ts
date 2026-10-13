import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength, MinLength } from "class-validator"

@InputType()
/** Bounded arguments for billingPlan. */
export class BillingPlanInput {
    /** The code selector. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    @Matches(/^[a-z0-9_-]+$/)
    code!: string
}
