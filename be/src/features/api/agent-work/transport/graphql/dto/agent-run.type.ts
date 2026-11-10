import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One run as the list of runs draws it. */
export class AgentRunRowType {
    /** The run. */
    @Field(() => ID)
    id!: string

    /** queued, scheduled, running, waiting, done, failed or cancelled. */
    @Field()
    status!: string

    /** customer, schedule, event, agent or person. */
    @Field()
    source!: string

    /** What the run was about, or empty. */
    @Field()
    title!: string

    /** The graph version it ran on, or none. */
    @Field()
    workflowKey!: string

    /** The number of that version, or null. */
    @Field(() => Int, { nullable: true })
    versionNumber!: number | null

    /** When it started, ISO 8601. */
    @Field()
    startedAt!: string

    /** When it ended, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    endedAt!: string | null

    /** How long it took, or has taken, milliseconds. */
    @Field(() => Int)
    durationMs!: number

    /** The steps written so far. */
    @Field(() => Int)
    stepTotal!: number

    /** The step it stands on, from one. */
    @Field(() => Int)
    stepNumber!: number

    /** Its place in the queue, from one, or null. */
    @Field(() => Int, { nullable: true })
    queuePosition!: number | null

    /** Why it stopped, or null. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null

    /** The work item it is about, or null. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** The credits the run's model calls consumed; 0 when it made none. */
    @Field(() => Int)
    creditsUsed!: number

    /** When an owner or manager cancelled the run, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    cancelledAt!: string | null
}

@ObjectType()
/** One workflow of the agent with how many runs it has. */
export class AgentRunWorkflowType {
    /** The graph version id, or none. */
    @Field()
    key!: string

    /** The number of the version, or null. */
    @Field(() => Int, { nullable: true })
    versionNumber!: number | null

    /** The runs of it in the list. */
    @Field(() => Int)
    count!: number
}

@ObjectType()
/** The runs of one agent: the list, its workflows and what is running and queued now. */
export class AgentRunsType {
    /** The newest runs, newest first. */
    @Field(() => [AgentRunRowType])
    runs!: Array<AgentRunRowType>

    /** The workflows the runs ran. */
    @Field(() => [AgentRunWorkflowType])
    workflows!: Array<AgentRunWorkflowType>

    /** The runs being driven now. */
    @Field(() => Int)
    runningCount!: number

    /** The runs that wait for a place. */
    @Field(() => Int)
    queuedCount!: number

    /** How many runs one process drives at once. */
    @Field(() => Int)
    concurrencyLimit!: number

    /** The runs using a place now (running, not waiting on a person). */
    @Field(() => Int)
    activeCount!: number
}
