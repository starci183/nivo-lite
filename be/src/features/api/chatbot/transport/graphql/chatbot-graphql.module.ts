import { Module } from "@nestjs/common"
import { ChatbotApiModule } from "../../chatbot.module"
import { ChatbotGapsResolver } from "./chatbot-gaps.resolver"
import { ChatbotOverviewResolver } from "./chatbot-overview.resolver"
import { ChatbotThreadResolver } from "./chatbot-thread.resolver"

@Module({
    imports: [ChatbotApiModule],
    providers: [ChatbotOverviewResolver, ChatbotThreadResolver, ChatbotGapsResolver],
})
/** The GraphQL transport of the customer Chatbot workbench. */
export class ChatbotGraphqlModule {}
