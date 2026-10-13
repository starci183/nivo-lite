import { Field, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded arguments of the decision history. */
export class ListDecisionHistoryInput {
    /** Which decisions: every one, those the policy made alone, those a person made, or the rejected ones. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["all", "policy", "human", "rejected"])
    kind: "all" | "policy" | "human" | "rejected" = "all"

    /** Only the decisions of this module; null for every module. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    department: string | null = null

    /** How many lines, 1 to 100; 50 when absent. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 50
}
