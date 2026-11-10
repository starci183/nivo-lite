import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { ChatRoomKind } from "./chat-room-kind.type"
import { ChatRoomPurpose } from "./chat-room-purpose.type"
import { ChatMemberType } from "./chat-member.type"
import { ChatMessageType } from "./chat-message.type"

@ObjectType()
/** One room for the viewer. */
export class ChatRoomType {
    /** The room. */
    @Field(() => ID)
    id!: string

    /** Direct or group. */
    @Field(() => ChatRoomKind)
    kind!: string

    /** What the room is for. */
    @Field(() => ChatRoomPurpose)
    purpose!: string

    /** The module whose team room it is; null unless the purpose is module. */
    @Field(() => String, { nullable: true })
    purposeModule!: string | null

    /** A group's name; a direct room shows the other party. */
    @Field(() => String)
    name!: string

    /** Where it sorts among rooms without a message. */
    @Field(() => Int)
    position!: number

    /** The account that created it. */
    @Field(() => ID)
    createdBy!: string

    /** When it was created. */
    @Field(() => String)
    createdAt!: string

    /** Its members, at most 200, owners first. */
    @Field(() => [ChatMemberType])
    members!: ReadonlyArray<ChatMemberType>

    /** What the viewer has not read. */
    @Field(() => Int)
    unreadCount!: number

    /** The unread ones that mention the viewer. */
    @Field(() => Int)
    mentionCount!: number

    /** Whether the viewer muted it. */
    @Field(() => Boolean)
    muted!: boolean

    /** The newest message. */
    @Field(() => ChatMessageType, { nullable: true })
    lastMessage!: ChatMessageType | null
}
