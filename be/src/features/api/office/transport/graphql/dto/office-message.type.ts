import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of the Office thread. */
export class OfficeMessageType {
    /** The message id. */
    @Field(() => ID)
    id!: string

    /** `human`, `agent` or `system`. */
    @Field()
    author_kind!: string

    /** The name shown as author. */
    @Field()
    author_name!: string

    /** The agent that spoke, when one did. */
    @Field(() => ID, { nullable: true })
    agent_id?: string | null

    /** The staff member that wrote, when one did. */
    @Field(() => ID, { nullable: true })
    staff_id?: string | null

    /** The text. */
    @Field()
    body!: string

    /** The customer it is about. */
    @Field(() => ID, { nullable: true })
    lead_id?: string | null

    /** The work item it mirrors. */
    @Field(() => ID, { nullable: true })
    work_item_id?: string | null

    /** When it was posted, ISO 8601. */
    @Field()
    created_at!: string
}
