import { Field, ObjectType } from "@nestjs/graphql"
import { ChatbotConversationType } from "./chatbot-conversation.type"
import { ChatbotMessageType } from "./chatbot-message.type"
import { ChatbotLeadType } from "./chatbot-lead.type"
import { ChatbotEscalationType } from "./chatbot-escalation.type"

@ObjectType()
/** An open customer thread, lead and escalation. */
export class ChatbotThreadType {
    /** The conversation value. */
    @Field(() => ChatbotConversationType)
    conversation!: ChatbotConversationType

    /** The messages value. */
    @Field(() => [ChatbotMessageType])
    messages!: Array<ChatbotMessageType>

    /** The lead value. */
    @Field(() => ChatbotLeadType, { nullable: true })
    lead!: ChatbotLeadType | null

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
