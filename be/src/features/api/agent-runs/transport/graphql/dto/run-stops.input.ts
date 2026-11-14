import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** Which page of the open stops to read. */
export class RunStopsInput {
    /** How many stops, 1 to 50 (20 when absent). */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number | null

    /** The `next` of the page before. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(8)
    cursor?: string | null
}
