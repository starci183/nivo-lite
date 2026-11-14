import { Field, ObjectType } from "@nestjs/graphql"
import { AgentWorkflowNodeRightType } from "./agent-workflow-node-right.type"
import { AgentWorkflowStepDiffType } from "./agent-workflow-step-diff.type"

@ObjectType()
/** How one graph differs from another, step by step, with both graphs as JSON text. */
export class AgentWorkflowDiffType {
    /** The steps that differ. */
    @Field(() => [AgentWorkflowStepDiffType])
    steps!: ReadonlyArray<AgentWorkflowStepDiffType>

    /** Whether what wakes the graph changed. */
    @Field(() => Boolean)
    triggerChanged!: boolean

    /** The tools gained. */
    @Field(() => [String])
    toolsAdded!: ReadonlyArray<string>

    /** The tools lost. */
    @Field(() => [String])
    toolsRemoved!: ReadonlyArray<string>

    /** The effects gained. */
    @Field(() => [String])
    effectsAdded!: ReadonlyArray<string>

    /** The effects lost. */
    @Field(() => [String])
    effectsRemoved!: ReadonlyArray<string>

    /** The operations on connected accounts the nodes ask for that they did not. */
    @Field(() => [AgentWorkflowNodeRightType])
    nodeRightsAdded!: ReadonlyArray<AgentWorkflowNodeRightType>

    /** The operations on connected accounts the nodes no longer ask for. */
    @Field(() => [AgentWorkflowNodeRightType])
    nodeRightsRemoved!: ReadonlyArray<AgentWorkflowNodeRightType>

    /** The operations the nodes asked to call after a person's yes and now ask to call by themselves. */
    @Field(() => [AgentWorkflowNodeRightType])
    nodeRightsLoosened!: ReadonlyArray<AgentWorkflowNodeRightType>

    /** The graph before, or null for a first version. */
    @Field(() => String, { nullable: true })
    beforeJson!: string | null

    /** The graph after. */
    @Field(() => String)
    afterJson!: string
}
