import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Pauses or resumes an agent. */
export class SetAgentStatusInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string

    /** True to resume the agent, false to pause it. */
    @Field()
    @IsBoolean()
    active!: boolean
}
