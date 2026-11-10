import { Field, ID, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What agentRunWorkflows takes. */
export class AgentRunWorkflowsInput {
    /** The installation whose agent holds the workflows. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    installationId!: string

    /** The runs, at most 100. */
    @Field(() => [String])
    @IsArray()
    @ArrayMaxSize(100)
    @IsUUID("all", { each: true })
    @MaxLength(36, { each: true })
    runIds!: Array<string>
}
