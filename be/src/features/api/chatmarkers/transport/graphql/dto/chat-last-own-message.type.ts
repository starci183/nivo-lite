import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { ChatMessageStatus } from "./chat-message-status.type"
import { ChatSeenMemberType } from "./chat-seen-member.type"

@ObjectType()
/** Receipt displayed only under the caller's last authored message in the target. */
export class ChatLastOwnMessageType {
    /** The last message authored by the current account. */
    @Field(() => ID)
    id!: string

    /** Seen takes precedence over delivered; another active member must acknowledge it. */
    @Field(() => ChatMessageStatus)
    status!: "sent" | "delivered" | "seen"

    /** At most three readers, excluding the author, in deterministic order. */
    @Field(() => [ChatSeenMemberType])
    seenBy!: Array<ChatSeenMemberType>

    /** Total other active readers, including those beyond the preview limit. */
    @Field(() => Int)
    seenByCount!: number
}
