import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The goals and house rules the Authority page edits. */
export class AuthorityProfileType {
    /** The business policies. */
    @Field()
    policies!: string

    /** How replies are written. */
    @Field()
    reply_style!: string

    /** The brand voice. */
    @Field()
    brand_voice!: string

    /** What the agent must always ask about first. */
    @Field()
    limits_note!: string

    /** The monthly revenue goal, VND. */
    @Field(() => Float, { nullable: true })
    goal_revenue_vnd?: number | null

    /** The new-customer goal. */
    @Field(() => Int, { nullable: true })
    goal_new_customers?: number | null

    /** The first-reply goal, minutes. */
    @Field(() => Int, { nullable: true })
    goal_first_reply_minutes?: number | null

    /** Free note on the goals. */
    @Field()
    goal_note!: string

    /** Who saved it last. */
    @Field(() => String, { nullable: true })
    updated_by?: string | null

    /** When it was saved last, ISO 8601. */
    @Field()
    updated_at!: string
}
