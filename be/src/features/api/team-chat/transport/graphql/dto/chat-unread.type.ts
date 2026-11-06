import { Field, Int, ObjectType } from "@nestjs/graphql"
import { ChatRoomUnreadType } from "./chat-room-unread.type"

@ObjectType()
/** What the viewer has unread. */
export class ChatUnreadType {
    /** Unread messages in all. */
    @Field(() => Int)
    total!: number

    /** Unread messages that mention the viewer. */
    @Field(() => Int)
    mentionTotal!: number

    /** The rooms with something unread. */
    @Field(() => [ChatRoomUnreadType])
    rooms!: ReadonlyArray<ChatRoomUnreadType>
}
