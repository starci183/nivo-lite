import { Field, ObjectType } from "@nestjs/graphql"
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

    /** The rights gained. */
    @Field(() => [String])
    rightsAdded!: ReadonlyArray<string>

    /** The rights lost. */
    @Field(() => [String])
    rightsRemoved!: ReadonlyArray<string>

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

    /** The graph before, or null for a first version. */
    @Field(() => String, { nullable: true })
    beforeJson!: string | null

    /** The graph after. */
    @Field(() => String)
    afterJson!: string
}
