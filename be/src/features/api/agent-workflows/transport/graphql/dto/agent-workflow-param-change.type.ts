import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One setting of a step that changed. */
export class AgentWorkflowParamChangeType {
    /** The setting. */
    @Field(() => String)
    name!: string

    /** Its value before, as JSON text, or null. */
    @Field(() => String, { nullable: true })
    beforeJson!: string | null

    /** Its value after, as JSON text, or null. */
    @Field(() => String, { nullable: true })
    afterJson!: string | null
}
