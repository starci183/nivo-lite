import { Field, ObjectType } from "@nestjs/graphql"
import { ChatbotConversationType } from "./chatbot-conversation.type"
import { ChatbotMessageType } from "./chatbot-message.type"
import { ChatbotEscalationType } from "./chatbot-escalation.type"

@ObjectType()
/** An open customer thread and its escalation. */
export class ChatbotThreadType {
    /** The conversation value. */
    @Field(() => ChatbotConversationType)
    conversation!: ChatbotConversationType

    /** The messages value. */
    @Field(() => [ChatbotMessageType])
    messages!: Array<ChatbotMessageType>

    /** The escalation value. */
    @Field(() => ChatbotEscalationType, { nullable: true })
    escalation!: ChatbotEscalationType | null

    /** The external id value. */
    @Field(() => String, { nullable: true })
    externalId!: string | null

    /** The handled at value. */
    @Field(() => String, { nullable: true })
    handledAt!: string | null
}
