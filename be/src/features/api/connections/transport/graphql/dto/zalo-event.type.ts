import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of the live Zalo events. */
export class ZaloEventType {
    /** A stable id of the line. */
    @Field(() => ID)
    id!: string

    /** user_send_text, follow, agent_reply or renewal_qr. */
    @Field(() => String)
    kind!: string

    /** received, sent or not_sent. */
    @Field(() => String)
    outcome!: string

    /** When, ISO 8601. */
    @Field(() => String)
    at!: string

    /** The customer, or an empty text. */
    @Field(() => String)
    who!: string

    /** A short excerpt of the text. */
    @Field(() => String)
    text!: string

    /** Why a reply was not sent. */
    @Field(() => String, { nullable: true })
    reason!: string | null
}
