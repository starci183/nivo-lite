import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, Max, Min } from "class-validator"

@InputType()
/** How many days back the AI work summary covers. */
export class CreditWorkUsageInput {
    /** Days back from now, 1 to 90; 30 when absent. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(90)
    days?: number | null
}
