import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of a customer's evidence history. */
export class LeadEventType {
    /** The evidence-line id. */
    @Field(() => ID)
    id!: string

    /** The customer lead, when the line is linked to one. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The event's dotted kind. */
    @Field()
    kind!: string

    /** The person or agent that performed the action. */
    @Field()
    actor!: string

    /** The short action description. */
    @Field()
    summary!: string

    /** The evidence behind the action, when provided. */
    @Field(() => String, { nullable: true })
    evidence!: string | null

    /** When the evidence was recorded, ISO 8601. */
    @Field()
    createdAt!: string
}
