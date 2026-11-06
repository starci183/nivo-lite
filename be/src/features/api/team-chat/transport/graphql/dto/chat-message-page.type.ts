import { Field, ObjectType } from "@nestjs/graphql"
import { ChatMessageType } from "./chat-message.type"
import { ChatPageInfoType } from "./chat-page-info.type"

@ObjectType()
/** A page of a thread, newest first. */
export class ChatMessagePageType {
    /** The messages. */
    @Field(() => [ChatMessageType])
    nodes!: ReadonlyArray<ChatMessageType>

    /** Whether another page exists. */
    @Field(() => ChatPageInfoType)
    pageInfo!: ChatPageInfoType
}
