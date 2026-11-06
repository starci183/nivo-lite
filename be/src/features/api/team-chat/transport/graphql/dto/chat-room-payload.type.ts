import { Field, ObjectType } from "@nestjs/graphql"
import { ChatRoomType } from "./chat-room.type"
import { ChatRefusal } from "./chat-refusal.type"

@ObjectType()
/** A room or why the mutation refused. */
export class ChatRoomPayloadType {
    /** The room. */
    @Field(() => ChatRoomType, { nullable: true })
    room!: ChatRoomType | null

    /** Why it refused. */
    @Field(() => ChatRefusal, { nullable: true })
    refusal!: string | null
}
