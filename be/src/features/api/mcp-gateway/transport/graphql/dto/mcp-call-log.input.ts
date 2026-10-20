import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, Max, Min } from "class-validator"

@InputType()
/** Which page of the gateway audit log to read. */
export class McpCallLogInput {
    /** How many lines, 1 to 200 (50 when absent). */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number | null
}
