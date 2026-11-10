import { Field, Int, ObjectType } from "@nestjs/graphql"
import { WorkflowTemplateConnectionType } from "./workflow-template-connection.type"
import { WorkflowTemplateVersionType } from "./workflow-template-version.type"

@ObjectType()
/** A workflow template of the market. */
export class WorkflowTemplateType {
    /** The template. */
    @Field(() => String)
    id!: string

    /** The module whose agent runs it. */
    @Field(() => String)
    moduleKey!: string

    /** Whether it is the template of an agent's main workflow. */
    @Field(() => Boolean)
    primary!: boolean

    /** The name. */
    @Field(() => String)
    name!: string

    /** What it does. */
    @Field(() => String)
    summary!: string

    /** The newest version. */
    @Field(() => Int)
    latestVersion!: number

    /** How many shops run a workflow made from it. */
    @Field(() => Int)
    shops!: number

    /** The connections it needs. */
    @Field(() => [WorkflowTemplateConnectionType])
    requires!: ReadonlyArray<WorkflowTemplateConnectionType>

    /** Every version, oldest first. */
    @Field(() => [WorkflowTemplateVersionType])
    versions!: ReadonlyArray<WorkflowTemplateVersionType>

    /** The graph of the newest version, as JSON text. */
    @Field(() => String)
    graphJson!: string
}
