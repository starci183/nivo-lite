import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The message a reply quotes. */
export class ChatReplyType {
    /** The quoted message. */
    @Field(() => ID)
    messageId!: string

    /** The name of its author; empty for a system line. */
    @Field(() => String)
    authorName!: string

    /** The first words of it, on one line. */
    @Field(() => String)
    body!: string
}
