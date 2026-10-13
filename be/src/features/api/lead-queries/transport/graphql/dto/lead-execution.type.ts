import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One approval card in a customer's journey. */
export class LeadExecutionType {
    /** The approval-card id. */
    @Field(() => ID)
    id!: string

    /** The workspace that owns the card. */
    @Field(() => ID)
    workspaceId!: string

    /** The responsibility whose draft is reviewed. */
    @Field(() => ID)
    responsibilityId!: string

    /** The agent that drafted the action, when there is one. */
    @Field(() => ID, { nullable: true })
    agentId!: string | null

    /** The action kind. */
    @Field()
    kind!: string

    /** The action's draft text. */
    @Field()
    draft!: string

    /** The card's current approval status. */
    @Field()
    status!: string

    /** The person that decided the card, when decided. */
    @Field(() => String, { nullable: true })
    decidedBy!: string | null

    /** The decision time, ISO 8601, when decided. */
    @Field(() => String, { nullable: true })
    decidedAt!: string | null

    /** The work item the card belongs to, when there is one. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** When the card was created, ISO 8601. */
    @Field()
    createdAt!: string
}
