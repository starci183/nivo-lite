import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A connection a template needs. */
export class WorkflowTemplateConnectionType {
    /** The connection kind. */
    @Field(() => String)
    kind!: string

    /** Its name. */
    @Field(() => String)
    label!: string

    /** What the graph uses it for. */
    @Field(() => String)
    why!: string
}
