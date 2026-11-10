import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One item that waits for the owner decision. */
export class WorkspaceDashboardApprovalType {
    /** The work item. */
    @Field(() => ID)
    id!: string

    /** The agent that raised it. */
    @Field(() => String, { nullable: true })
    agentName!: string | null

    /** The action key, worded by the reader. */
    @Field()
    action!: string

    /** The one-line summary, when the proposal has one. */
    @Field(() => String, { nullable: true })
    summary!: string | null

    /** The customer the proposal names. */
    @Field(() => String, { nullable: true })
    customer!: string | null

    /** When it was raised, ISO 8601. */
    @Field()
    createdAt!: string

    /** The path inside the workspace that opens the item. */
    @Field()
    href!: string
}
