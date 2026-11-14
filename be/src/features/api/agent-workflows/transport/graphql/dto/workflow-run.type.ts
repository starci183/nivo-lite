import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One problem of the inputs a start was given. */
export class WorkflowRunIssueType {
    /** The input's name. */
    @Field(() => String)
    at!: string

    /** required, unknown or type. */
    @Field(() => String)
    code!: string
}

@ObjectType()
/** What a start of a workflow came to. */
export class WorkflowRunType {
    /** started (queued for the engine; the same opKey again is the same start) or refused. */
    @Field(() => String)
    status!: string

    /** Why it was refused, or null. */
    @Field(() => String, { nullable: true })
    refusal!: string | null

    /** The inputs' problems of an input_invalid refusal. */
    @Field(() => [WorkflowRunIssueType])
    issues!: Array<WorkflowRunIssueType>
}

@ObjectType()
/** Whether a person may start one workflow, and the JSON Schema of its declared input. */
export class RunnableWorkflowType {
    /** The workflow. */
    @Field(() => String)
    workflowId!: string

    /** Its key within the agent. */
    @Field(() => String)
    key!: string

    /** Its name. */
    @Field(() => String)
    name!: string

    /** active, draft or paused. */
    @Field(() => String)
    status!: string

    /** True when a person may start it now. */
    @Field(() => Boolean)
    runnable!: boolean

    /** not_active, not_callable, agent_only or graph_unreadable; null when runnable. */
    @Field(() => String, { nullable: true })
    refusal!: string | null

    /** The JSON Schema of its declared input as JSON text, or null when it cannot be started. */
    @Field(() => String, { nullable: true })
    inputSchemaJson!: string | null
}
