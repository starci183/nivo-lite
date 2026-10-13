import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ChatbotConversationType } from "./chatbot-conversation.type"
import { ChatbotMetricsType } from "./chatbot-metrics.type"

@ObjectType()
/** The selected Chatbot inbox and header figures. */
export class ChatbotOverviewType {
    /** The workspace id value. */
    @Field(() => ID)
    workspaceId!: string

    /** The now iso value. */
    @Field(() => String)
    nowIso!: string

    /** The conversations value. */
    @Field(() => [ChatbotConversationType])
    conversations!: Array<ChatbotConversationType>

    /** The metrics value. */
    @Field(() => ChatbotMetricsType)
    metrics!: ChatbotMetricsType
}
