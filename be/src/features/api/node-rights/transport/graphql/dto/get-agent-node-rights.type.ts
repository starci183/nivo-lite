import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { NodeRightOperationType, NodeRightWordsType } from "./node-right-operation.type"

@ObjectType()
/** One account an agent is attached to, with how many of its running steps use it and what its provider offers a node. */
export class AgentRightAccountType {
    /** The connected account. */
    @Field(() => ID)
    connectionId!: string

    /** Its provider. */
    @Field(() => String)
    provider!: string

    /** The kind of account (messaging, payment, books, mail, records), or null for a provider outside the rights catalogue. */
    @Field(() => String, { nullable: true })
    kind!: string | null

    /** The name the owner gave the account. */
    @Field(() => String)
    name!: string

    /** How many nodes of the agent's running workflows ask for an operation on it. */
    @Field(() => Int)
    stepsUsing!: number

    /** The operations its provider offers an agent: what a node's panel lists to choose from. */
    @Field(() => [NodeRightOperationType])
    operations!: ReadonlyArray<NodeRightOperationType>
}

@ObjectType()
/** One row of the agent's roll-up: an operation a running node asks for on an account. */
export class AgentRightRowType {
    /** The operation. */
    @Field(() => NodeRightOperationType)
    operation!: NodeRightOperationType

    /** The connected account. */
    @Field(() => ID)
    connectionId!: string

    /** auto or ask. */
    @Field(() => String)
    mode!: string

    /** The number of the workflow version that runs and asks for the entry. */
    @Field(() => Int)
    versionNumber!: number

    /** The workflow. */
    @Field(() => ID)
    workflowId!: string

    /** Its key within the agent. */
    @Field(() => String)
    workflowKey!: string

    /** Its name. */
    @Field(() => String)
    workflowName!: string

    /** The key of the node in the workflow's graph. */
    @Field(() => String)
    nodeKey!: string

    /** The id of the step the node runs. */
    @Field(() => String)
    step!: string

    /** The title of that step as its installed node declares it, in the owner's two languages; null for a step no installed node is. */
    @Field(() => NodeRightWordsType, { nullable: true })
    stepTitle!: NodeRightWordsType | null
}

@ObjectType()
/** The rights page of one agent. */
export class AgentNodeRightsType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** The accounts the agent is attached to. */
    @Field(() => [AgentRightAccountType])
    accounts!: ReadonlyArray<AgentRightAccountType>

    /** What the agent's running nodes ask for, in workflow, node, account and operation order. */
    @Field(() => [AgentRightRowType])
    rows!: ReadonlyArray<AgentRightRowType>
}
