import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One piece of recent work of an agent. */
export class AgentRecentWorkType {
    /** The work item. */
    @Field(() => ID)
    id!: string

    /** The action key, for the label. */
    @Field()
    action!: string

    /** The one-line summary; empty when the item has none. */
    @Field()
    title!: string

    /** The customer, or an empty text. */
    @Field()
    customer!: string

    /** `queued`, `done`, `waiting_decision`, `rejected` or `failed`. */
    @Field()
    status!: string

    /** When it was last touched, ISO 8601. */
    @Field()
    at!: string

    /** The lead it is about, or null. */
    @Field(() => ID, { nullable: true })
    leadId?: string | null
}
