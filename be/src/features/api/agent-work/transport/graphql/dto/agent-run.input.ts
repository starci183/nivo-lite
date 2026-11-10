import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one run of an agent instance. */
export class AgentRunInput {
    /** The agent instance. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** The run. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    runId!: string
}
