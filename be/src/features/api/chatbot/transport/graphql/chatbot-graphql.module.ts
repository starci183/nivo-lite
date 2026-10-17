import { Module } from "@nestjs/common"
import { ChatbotApiModule } from "../../chatbot.module"
import { ChatbotGapsResolver } from "./chatbot-gaps.resolver"
import { ConfigurableModuleClass } from "./chatbot-graphql.module-definition"
import { ChatbotOverviewResolver } from "./chatbot-overview.resolver"
import { ChatbotThreadResolver } from "./chatbot-thread.resolver"

@Module({
    imports: [ChatbotApiModule.register({})],
    providers: [ChatbotOverviewResolver, ChatbotThreadResolver, ChatbotGapsResolver],
})
/** The GraphQL transport of the customer Chatbot workbench. */
export class ChatbotGraphqlModule extends ConfigurableModuleClass {}
