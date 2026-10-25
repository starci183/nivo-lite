import { Field, ObjectType } from "@nestjs/graphql"
import { ChatLastOwnMessageType } from "./chat-last-own-message.type"

@ObjectType()
/** Member-local notification state and the receipt of their last authored message. */
export class ChatMarkerStateType {
    /** The current member's mute preference; false before it is set. */
    @Field(() => Boolean)
    muted!: boolean

    /** Null when this member has not authored a message in this target. */
    @Field(() => ChatLastOwnMessageType, { nullable: true })
    lastOwnMessage!: ChatLastOwnMessageType | null
}
