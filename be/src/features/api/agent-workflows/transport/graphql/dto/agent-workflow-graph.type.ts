import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One input of a workflow's contract. */
export class WorkflowGraphInputType {
    /** The input name. */
    @Field(() => String)
    name!: string

    /** Its type. */
    @Field(() => String)
    type!: string

    /** Whether the caller must give it. */
    @Field(() => Boolean)
    required!: boolean
}

@ObjectType()
/** Where one input of a workflow is woken from. */
export class WorkflowGraphTriggerType {
    /** The trigger key. */
    @Field(() => String)
    key!: string

    /** The kind of source. */
    @Field(() => String)
    sourceKind!: string

    /** The source in words. */
    @Field(() => String)
    sourceLabel!: string

    /** The connection it listens on, or null. */
    @Field(() => String, { nullable: true })
    connectionId!: string | null
}

@ObjectType()
/** One output of an outcome. */
export class WorkflowGraphOutputType {
    /** The output name. */
    @Field(() => String)
    name!: string

    /** Its type. */
    @Field(() => String)
    type!: string
}

@ObjectType()
/** One named business end of a workflow. */
export class WorkflowGraphOutcomeType {
    /** The outcome key. */
    @Field(() => String)
    key!: string

    /** The outcome in words. */
    @Field(() => String)
    label!: string

    /** What it hands back. */
    @Field(() => [WorkflowGraphOutputType])
    outputs!: ReadonlyArray<WorkflowGraphOutputType>
}

@ObjectType()
/** One end hand-off of a workflow: the outcome it follows and the workflow it calls. */
export class WorkflowGraphCallType {
    /** The hand-off step. */
    @Field(() => String)
    nodeKey!: string

    /** The outcome key it follows, or null. */
    @Field(() => String, { nullable: true })
    outcome!: string | null

    /** The module of the agent it calls. */
    @Field(() => String)
    agent!: string

    /** That agent's name. */
    @Field(() => String)
    agentLabel!: string

    /** The picture of the agent that runs the target, or null (the page shows the module icon). */
    @Field(() => String, { nullable: true })
    agentAvatar!: string | null

    /** The key of the workflow it calls. */
    @Field(() => String)
    workflow!: string

    /** That workflow's name, or null when the workspace has no such workflow. */
    @Field(() => String, { nullable: true })
    workflowName!: string | null

    /** latest, or the pinned number as text. */
    @Field(() => String)
    version!: string

    /** True when the target is run by another agent (or not found). */
    @Field(() => Boolean)
    crossAgent!: boolean
}

@ObjectType()
/** One workflow of an agent as its Graph page draws it. */
export class WorkflowGraphEntryType {
    /** The workflow. */
    @Field(() => ID)
    id!: string

    /** The stable key within the agent. */
    @Field(() => String)
    key!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** active, draft or paused. */
    @Field(() => String)
    status!: string

    /** Whether it is the agent's main workflow. */
    @Field(() => Boolean)
    primary!: boolean

    /** The number of the version that runs, or null. */
    @Field(() => Int, { nullable: true })
    activeNumber!: number | null

    /** Who may call it: any or agent. */
    @Field(() => String)
    entry!: string

    /** The entry rule in words. */
    @Field(() => String)
    entryLabel!: string

    /** Its input contract. */
    @Field(() => [WorkflowGraphInputType])
    inputs!: ReadonlyArray<WorkflowGraphInputType>

    /** Where each input is woken from. */
    @Field(() => [WorkflowGraphTriggerType])
    triggers!: ReadonlyArray<WorkflowGraphTriggerType>

    /** Its named business ends. */
    @Field(() => [WorkflowGraphOutcomeType])
    outcomes!: ReadonlyArray<WorkflowGraphOutcomeType>

    /** Its end hand-offs. */
    @Field(() => [WorkflowGraphCallType])
    calls!: ReadonlyArray<WorkflowGraphCallType>
}

@ObjectType()
/** The agent Graph page: every workflow of one agent. */
export class AgentWorkflowGraphType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** The installed agent's display name. */
    @Field(() => String)
    agentLabel!: string

    /** The installed agent picture, or null. */
    @Field(() => String, { nullable: true })
    agentAvatar!: string | null

    /** Its workflows. */
    @Field(() => [WorkflowGraphEntryType])
    workflows!: ReadonlyArray<WorkflowGraphEntryType>
}
