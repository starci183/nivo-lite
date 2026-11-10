import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One installed agent row of the performance table. */
export class WorkspaceDashboardAgentType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** The display name. */
    @Field()
    name!: string

    /** The @handle. */
    @Field()
    handle!: string

    /** The module the agent belongs to. */
    @Field()
    module!: string

    /** Items finished in the period. */
    @Field(() => Int)
    tasksDone!: number

    /** Of those, the share finished by policy alone, 0..1; null when none finished. */
    @Field(() => Float, { nullable: true })
    autoRate!: number | null

    /** Items that wait for the owner now. */
    @Field(() => Int)
    waiting!: number

    /** Failed items and failed runs in the period. */
    @Field(() => Int)
    errors!: number

    /** The middle time to finish an item by policy alone, seconds; null when none. */
    @Field(() => Float, { nullable: true })
    medianResponseSeconds!: number | null

    /** Minutes saved in the period. */
    @Field(() => Float)
    minutesSaved!: number

    /** Credits spent in the period. */
    @Field(() => Int)
    credits!: number
}
