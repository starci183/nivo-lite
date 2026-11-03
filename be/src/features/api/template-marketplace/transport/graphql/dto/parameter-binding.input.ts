import { Field, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Where a parameter lands in the graph. */
export class ParameterBindingInput {
    /** The parameter key. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    parameter!: string

    /** `branch_value` or `branch_timeout`. */
    @Field(() => String)
    @IsIn(["branch_value", "branch_timeout"])
    target!: string

    /** The node. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    nodeKey!: string

    /** The branch. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    branchKey!: string

    /** Which term of the condition, for a value. */
    @Field(() => Int, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(30)
    termIndex?: number
}
