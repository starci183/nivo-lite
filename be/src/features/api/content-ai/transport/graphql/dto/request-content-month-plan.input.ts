import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** Bounded inputs to requestContentMonthPlan. */
export class RequestContentMonthPlanInput {
    /** The month to plan, YYYY-MM. */
    @Field()
    @IsString()
    @Matches(/^\d{4}-\d{2}$/u)
    @MaxLength(7)
    month!: string
}
