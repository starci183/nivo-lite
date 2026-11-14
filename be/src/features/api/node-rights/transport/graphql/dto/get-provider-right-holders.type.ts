import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { NodeRightOperationType, NodeRightWordsType } from "./node-right-operation.type"

@ObjectType()
/** One holder of a right of an account: a node of a running workflow of an agent. */
export class RightHolderType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** Its name. */
    @Field(() => String)
    agentName!: string

    /** The workflow. */
    @Field(() => ID)
    workflowId!: string

    /** Its key within the agent. */
    @Field(() => String)
    workflowKey!: string

    /** Its name. */
    @Field(() => String)
    workflowName!: string

    /** The key of the node. */
    @Field(() => String)
    nodeKey!: string

    /** The id of the step the node runs. */
    @Field(() => String)
    step!: string

    /** The title of that step as its installed node declares it, in the owner's two languages; null for a step no installed node is. */
    @Field(() => NodeRightWordsType, { nullable: true })
    stepTitle!: NodeRightWordsType | null

    /** auto or ask. */
    @Field(() => String)
    mode!: string

    /** The number of the workflow version that runs and asks for the entry. */
    @Field(() => Int)
    versionNumber!: number
}

@ObjectType()
/** One tool of the account's provider, with the nodes that call it: agent, workflow, step and that node's mode. Information only: nothing here is edited. */
export class ProviderToolRightType {
    /** The operation. */
    @Field(() => NodeRightOperationType)
    operation!: NodeRightOperationType

    /** False for an operation of the account's pinned document that no plugin opened as a tool: nobody can hold it. */
    @Field(() => Boolean)
    open!: boolean

    /** Who holds it; empty when no step asks for it. */
    @Field(() => [RightHolderType])
    holders!: ReadonlyArray<RightHolderType>
}

@ObjectType()
/** The figures of the filter tabs of the agent tools, counted over every row. */
export class ProviderRightCountsType {
    /** Every row. */
    @Field(() => Int)
    all!: number

    /** The rows some step holds. */
    @Field(() => Int)
    held!: number

    /** The rows no step holds (an operation that is not open is among them). */
    @Field(() => Int)
    unheld!: number

    /** The rows whose operation acts. */
    @Field(() => Int)
    writes!: number
}

@ObjectType()
/** One read a screen may show of the account: every member of the workspace holds it. */
export class ProviderScreenRightType {
    /** The name a screen calls it by: provider:read. */
    @Field(() => String)
    name!: string

    /** One line of what it answers, when the registry declares one; else null. */
    @Field(() => NodeRightWordsType, { nullable: true })
    summary!: NodeRightWordsType | null

    /** True: every member of the workspace may read it. */
    @Field(() => Boolean)
    everyMember!: boolean
}

@ObjectType()
/** One agent a trigger of the account wakes, and whether it decides on the events or is only told. */
export class TriggerHolderType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** Its name. */
    @Field(() => String)
    agentName!: string

    /** decider (the one agent that decides on the events) or notice (it is told). */
    @Field(() => String)
    role!: string

    /** The running workflow of the agent that registers on the trigger, or null for a decider no workflow of which registers. */
    @Field(() => ID, { nullable: true })
    workflowId!: string | null

    /** The name of that workflow, or null. */
    @Field(() => String, { nullable: true })
    workflowName!: string | null

    /** The key of that workflow within its agent, or null. */
    @Field(() => String, { nullable: true })
    workflowKey!: string | null

    /** The key of the node an event of the trigger starts (the first node of that workflow), or null with no workflow. */
    @Field(() => String, { nullable: true })
    nodeKey!: string | null

    /** The id of the step that node runs, or null. */
    @Field(() => String, { nullable: true })
    step!: string | null

    /** The title of that step as its installed node declares it; null with no workflow, or for a step no installed node is. */
    @Field(() => NodeRightWordsType, { nullable: true })
    stepTitle!: NodeRightWordsType | null
}

@ObjectType()
/** One trigger of the account's provider, with the agents it wakes. */
export class ProviderTriggerRightType {
    /** Its name inside the provider. */
    @Field(() => String)
    name!: string

    /** What it is, in the owner's two languages. */
    @Field(() => NodeRightWordsType)
    summary!: NodeRightWordsType

    /** The agents it wakes. */
    @Field(() => [TriggerHolderType])
    holders!: ReadonlyArray<TriggerHolderType>
}

@ObjectType()
/** The read-only Quyen tab of one connected account: the tools of its provider with the nodes that call them (derived from node tools), the reads and the triggers. */
export class ProviderRightHoldersType {
    /** The connected account. */
    @Field(() => ID)
    connectionId!: string

    /** Its provider. */
    @Field(() => String)
    provider!: string

    /** The rights an agent may hold: one row per tool, held or not, open or not. */
    @Field(() => [ProviderToolRightType])
    tools!: ReadonlyArray<ProviderToolRightType>

    /** The figures of the filter tabs over tools. */
    @Field(() => ProviderRightCountsType)
    counts!: ProviderRightCountsType

    /** The reads a screen may show: every member holds them. */
    @Field(() => [ProviderScreenRightType])
    screens!: ReadonlyArray<ProviderScreenRightType>

    /** The triggers, with the agents they wake. */
    @Field(() => [ProviderTriggerRightType])
    triggers!: ReadonlyArray<ProviderTriggerRightType>
}
