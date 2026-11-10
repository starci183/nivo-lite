import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The workflow and version one run executes. */
export class AgentRunWorkflowPinType {
    /** The run. */
    @Field(() => String)
    runId!: string

    /** The workflow. */
    @Field(() => String)
    workflowId!: string

    /** Its name. */
    @Field(() => String)
    workflowName!: string

    /** The workflow version number the run executes. */
    @Field(() => Int)
    version!: number
}
