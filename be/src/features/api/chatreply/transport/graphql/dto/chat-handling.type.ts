import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Who handles a customer conversation after a takeover or release. */
export class ChatHandlingType {
    /** The customer conversation. */
    @Field(() => ID)
    conversationId!: string

    /** The human holder, or null when the AI handles it. */
    @Field(() => String, { nullable: true })
    handledBy!: string | null
}
