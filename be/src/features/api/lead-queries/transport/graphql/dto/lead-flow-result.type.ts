import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The recorded outcome of a completed work item. */
export class LeadFlowResultType {
    /** A human-readable explanation of the completed action. */
    @Field()
    summary!: string

    /** The destination for inspecting the resulting record. */
    @Field(() => String, { nullable: true })
    href!: string | null
}
