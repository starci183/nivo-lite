import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of the evidence log. */
export class DashboardEventType {
    /** The event id. */
    @Field(() => ID)
    id!: string

    /** The lead it is about, or null. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The dotted kind. */
    @Field()
    kind!: string

    /** Who did it. */
    @Field()
    actor!: string

    /** The short sentence. */
    @Field()
    summary!: string

    /** The evidence behind it, or null. */
    @Field(() => String, { nullable: true })
    evidence!: string | null

    /** When it happened, ISO 8601. */
    @Field()
    createdAt!: string
}
