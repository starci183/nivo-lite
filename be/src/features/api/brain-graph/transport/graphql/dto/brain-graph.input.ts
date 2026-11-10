import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Which page of the truth graph to read. */
export class BrainGraphInput {
    /** Only this subject (its key, as a node carries it). */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(120)
    subjectKey?: string

    /** Only truths whose subject, attribute or value hold every one of these words ("Tim su that..."). */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    query?: string

    /** The `nextCursor` of the previous page. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(120)
    cursor?: string

    /** How many subjects one page holds, 1 to 100; 30 when absent. */
    @Field(() => Int, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number
}
