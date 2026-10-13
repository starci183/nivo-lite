import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A responsibility with the name of its customer. */
export class ResponsibilityListingType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The workspace. */
    @Field(() => ID)
    workspace_id!: string

    /** The customer. */
    @Field(() => ID)
    lead_id!: string

    /** What it is. */
    @Field()
    title!: string

    /** `human` or `agent`. */
    @Field()
    owner_kind!: string

    /** The owning agent, when an agent owns it. */
    @Field(() => ID, { nullable: true })
    owner_agent_id?: string | null

    /** The display name of the owner. */
    @Field()
    owner_name!: string

    /** The next step. */
    @Field()
    next_action!: string

    /** When it is due, ISO 8601. */
    @Field(() => String, { nullable: true })
    due_at?: string | null

    /** `open`, `waiting_approval` or `done`. */
    @Field()
    status!: string

    /** When it was created, ISO 8601. */
    @Field()
    created_at!: string

    /** The customer's name. */
    @Field()
    contact_name!: string

    /** The customer's company. */
    @Field(() => String, { nullable: true })
    company?: string | null

    /** The customer's journey stage. */
    @Field()
    leadStage!: string
}
