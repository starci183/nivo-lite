import { Field, ObjectType } from "@nestjs/graphql"
import { AgentWorkflowParamChangeType } from "./agent-workflow-param-change.type"

@ObjectType()
/** One step that differs between two graphs. */
export class AgentWorkflowStepDiffType {
    /** The node key. */
    @Field(() => String)
    key!: string

    /** added, removed or changed. */
    @Field(() => String)
    change!: string

    /** The SDK step it runs. */
    @Field(() => String)
    step!: string

    /** The parts that changed: kind, step, params, input, next, routes, blocking, group or wait. */
    @Field(() => [String])
    parts!: ReadonlyArray<string>

    /** The settings that changed. */
    @Field(() => [AgentWorkflowParamChangeType])
    params!: ReadonlyArray<AgentWorkflowParamChangeType>
}
