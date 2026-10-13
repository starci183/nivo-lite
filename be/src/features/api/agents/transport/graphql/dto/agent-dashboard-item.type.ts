import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of a list region: a decision waiting, or something the agent finished. */
export class AgentDashboardItemType {
    /** The work item. */
    @Field(() => ID)
    id!: string

    /** The one-line summary, clipped; empty when the item has none. */
    @Field()
    title!: string

    /** The action key, for the label. */
    @Field()
    action!: string

    /** The customer the item is about, or an empty text. */
    @Field()
    customer!: string

    /** When it was raised or finished, ISO 8601. */
    @Field()
    at!: string

    /** The lead the item is about, or null. */
    @Field(() => ID, { nullable: true })
    leadId?: string | null

    /** The href the finished work recorded as its evidence, or null. */
    @Field(() => String, { nullable: true })
    resultHref?: string | null
}
