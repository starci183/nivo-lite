import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The kill switch and the breaker of an agent. */
export class AgentWorkStateType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** False when work is switched off for the agent. */
    @Field(() => Boolean)
    workEnabled!: boolean

    /** Failed turns in a row. */
    @Field(() => Int)
    failures!: number

    /** Until when background work waits, ISO 8601, or null. */
    @Field(() => Date, { nullable: true })
    breakerUntil!: Date | null

    /** When the last turn ended, ISO 8601, or null. */
    @Field(() => Date, { nullable: true })
    lastTurnAt!: Date | null

    /** Background turns run today. */
    @Field(() => Int)
    backgroundTurns!: number
}
