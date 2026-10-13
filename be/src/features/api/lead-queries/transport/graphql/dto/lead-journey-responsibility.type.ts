import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One responsibility in a customer's journey. */
export class LeadJourneyResponsibilityType {
    /** The responsibility id. */
    @Field(() => ID)
    id!: string

    /** The customer lead. */
    @Field(() => ID)
    leadId!: string

    /** The responsibility's title. */
    @Field()
    title!: string

    /** Whether the owner is a person or an agent. */
    @Field()
    ownerKind!: string

    /** The agent owner, when owned by an agent. */
    @Field(() => ID, { nullable: true })
    ownerAgentId!: string | null

    /** The owner's display name. */
    @Field()
    ownerName!: string

    /** What the owner must do next. */
    @Field()
    nextAction!: string

    /** The due time, ISO 8601, when one is set. */
    @Field(() => String, { nullable: true })
    dueAt!: string | null

    /** The responsibility's current status. */
    @Field()
    status!: string

    /** When the responsibility was created, ISO 8601. */
    @Field()
    createdAt!: string
}
