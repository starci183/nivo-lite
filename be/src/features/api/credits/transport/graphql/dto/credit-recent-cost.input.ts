import { Field, InputType } from "@nestjs/graphql"
import { IsDateString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The first day included in the model-cost forecast. */
export class CreditRecentCostInput {
    /** First included day, YYYY-MM-DD. */
    @Field()
    @IsDateString({ strict: true })
    @MinLength(10)
    @MaxLength(10)
    from!: string
}
