import { Field, ID, InputType } from "@nestjs/graphql"
import { IsDate, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import type { AgentGoalStatus } from "@modules/domain/agent-work"

@InputType()
/** Adds a goal to an agent or changes one. */
export class SaveAgentGoalInput {
    /** The agent instance. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** The goal to change; absent or null for a new one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    goalId: string | null = null

    /** Short title, 1 to 200 characters. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title!: string

    /** Longer text, at most 2000 characters. */
    @Field()
    @IsString()
    @MaxLength(2000)
    detail!: string

    /** active, paused, done or dropped. */
    @Field()
    @IsIn(["active", "paused", "done", "dropped"])
    status!: AgentGoalStatus

    /** When it is due, ISO 8601; absent or null for none. */
    @Field(() => Date, { nullable: true })
    @IsOptional()
    @IsDate()
    dueAt: Date | null = null
}
