import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** What agentGraphRuns takes. */
export class ListAgentGraphRunsInput {
    /** The agent. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** How many runs to answer. */
    @Field(() => Int, { defaultValue: 50 })
    @IsInt()
    @Min(1)
    @Max(100)
    limit!: number
}
