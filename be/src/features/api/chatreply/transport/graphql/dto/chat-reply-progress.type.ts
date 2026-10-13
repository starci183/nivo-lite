import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The durable progress the frontend polls after queueing a reply or escalation decision. */
export class ChatReplyProgressType {
    /** The work item or message id used by its status query. */
    @Field(() => ID)
    id!: string

    /** queued, running, succeeded, or failed. */
    @Field()
    status!: string

    /** The approved or directly posted message, when available. */
    @Field(() => ID, { nullable: true })
    messageId!: string | null

    /** sent or failed after delivery, otherwise null. */
    @Field(() => String, { nullable: true })
    delivery!: string | null

    /** A stable failure code; no provider or exception prose. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null
}
