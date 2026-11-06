import { Field, ObjectType } from "@nestjs/graphql"
import { ChatMessageType } from "./chat-message.type"
import { ChatRefusal } from "./chat-refusal.type"

@ObjectType()
/** A message or why the mutation refused. */
export class ChatMessagePayloadType {
    /** The message. */
    @Field(() => ChatMessageType, { nullable: true })
    message!: ChatMessageType | null

    /** Why it refused. */
    @Field(() => ChatRefusal, { nullable: true })
    refusal!: string | null
}
