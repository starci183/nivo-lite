import { Field, ObjectType } from "@nestjs/graphql"
import { ChatRoomUnreadType } from "./chat-room-unread.type"
import { ChatRefusal } from "./chat-refusal.type"

@ObjectType()
/** The unread of a room or why the mutation refused. */
export class ChatReadPayloadType {
    /** The unread of the room. */
    @Field(() => ChatRoomUnreadType, { nullable: true })
    unread!: ChatRoomUnreadType | null

    /** Why it refused. */
    @Field(() => ChatRefusal, { nullable: true })
    refusal!: string | null
}
