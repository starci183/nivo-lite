import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A file of a line, with a short-lived address. */
export class OfficeMessageFileType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The name value. */
    @Field()
    name!: string

    /** The content type value. */
    @Field()
    contentType!: string

    /** The url value. */
    @Field()
    url!: string
}

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

    /** The account that wrote it; null on a legacy line or a line no member wrote. */
    @Field(() => ID, { nullable: true })
    author_user_id?: string | null

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

    /** The customer's name, when the line names one. */
    @Field(() => String, { nullable: true })
    lead_name?: string | null

    /** The department of the work item the line mirrors. */
    @Field(() => String, { nullable: true })
    department?: string | null

    /** The Hub room of the line; null is the general Office room. */
    @Field(() => String, { nullable: true })
    room?: string | null

    /** The result card payload as JSON text (contract v1), when the line is a card. */
    @Field(() => String, { nullable: true })
    card_json?: string | null

    /** The live card state: pending, approved, declined, done, failed, queued or info. */
    @Field(() => String, { nullable: true })
    card_state?: string | null

    /** When it was posted, ISO 8601. */
    @Field()
    created_at!: string

    /** The files that came with the line. */
    @Field(() => [OfficeMessageFileType])
    files!: ReadonlyArray<OfficeMessageFileType>
}
