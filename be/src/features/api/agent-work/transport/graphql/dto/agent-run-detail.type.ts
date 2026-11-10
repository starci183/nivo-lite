import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { AgentRunDecisionType } from "./agent-run-decision.type"
import { AgentRunRowType } from "./agent-run.type"

@ObjectType()
/** One plain fact of what a step was given or stored. */
export class AgentRunFactType {
    /** What it is. */
    @Field()
    key!: string

    /** Its value, as text. */
    @Field()
    value!: string
}

@ObjectType()
/** One door call a step made. */
export class AgentRunCallType {
    /** The tool. */
    @Field()
    tool!: string

    /** Whether it worked. */
    @Field()
    ok!: boolean

    /** Why it failed, or null. */
    @Field(() => String, { nullable: true })
    failure!: string | null
}

@ObjectType()
/** One step of a run. */
export class AgentRunStepType {
    /** Unique within the run. */
    @Field()
    stepKey!: string

    /** The node of the graph it is. */
    @Field()
    nodeKey!: string

    /** The place in the run, from one. */
    @Field(() => Int)
    ordinal!: number

    /** pending, running, waiting, done, failed or undone. */
    @Field()
    status!: string

    /** The tries made. */
    @Field(() => Int)
    attempt!: number

    /** The tries it gets. */
    @Field(() => Int)
    maxAttempts!: number

    /** When it began, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    startedAt!: string | null

    /** How long it took, milliseconds, or null. */
    @Field(() => Int, { nullable: true })
    durationMs!: number | null

    /** Why it last failed, or null. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null

    /** The work item it waits on or is about, or null. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** What it was given. */
    @Field(() => [AgentRunFactType])
    input!: Array<AgentRunFactType>

    /** What it stored. */
    @Field(() => [AgentRunFactType])
    output!: Array<AgentRunFactType>

    /** The door calls it made. */
    @Field(() => [AgentRunCallType])
    calls!: Array<AgentRunCallType>
}

@ObjectType()
/** The work item a run is about. */
export class AgentRunItemType {
    /** The work item. */
    @Field(() => ID)
    id!: string

    /** Its action key. */
    @Field()
    action!: string

    /** What it proposes, or did. */
    @Field()
    summary!: string

    /** queued, waiting_decision, done, rejected or failed. */
    @Field()
    status!: string

    /** Why the gate asked a person, or null. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** What the proposal carried as evidence. */
    @Field(() => [AgentRunFactType])
    evidence!: Array<AgentRunFactType>

    /** The failure, or null. */
    @Field(() => String, { nullable: true })
    error!: string | null
}

@ObjectType()
/** One run with its steps and the work item it is about. */
export class AgentRunDetailType {
    /** The run as the list draws it. */
    @Field(() => AgentRunRowType)
    row!: AgentRunRowType

    /** The steps in order. */
    @Field(() => [AgentRunStepType])
    steps!: Array<AgentRunStepType>

    /** The work item the run is about, or null. */
    @Field(() => AgentRunItemType, { nullable: true })
    item!: AgentRunItemType | null

    /** Whether the run may be run again from its failed step. */
    @Field()
    canResume!: boolean

    /** Whether the run is queued, running or waiting and may be cancelled. */
    @Field()
    canCancel!: boolean

    /** The decision the run waits on, or null when it waits on none. */
    @Field(() => AgentRunDecisionType, { nullable: true })
    decision!: AgentRunDecisionType | null
}
