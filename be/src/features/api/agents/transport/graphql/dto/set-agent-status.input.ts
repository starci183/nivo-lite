import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"

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

    /** Resume only: "resumed" keeps this agent on the channels another agent of the role answers, "current" keeps that agent. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["resumed", "current"])
    keep?: "resumed" | "current"
}
