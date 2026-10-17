import { Module } from "@nestjs/common"
import { GetChatbotGapsHandler } from "./application/get-chatbot-gaps.handler"
import { GetChatbotOverviewHandler } from "./application/get-chatbot-overview.handler"
import { GetChatbotThreadHandler } from "./application/get-chatbot-thread.handler"
import { ConfigurableModuleClass } from "./chatbot.module-definition"

@Module({
    providers: [GetChatbotOverviewHandler, GetChatbotThreadHandler, GetChatbotGapsHandler],
})
/** The customer Chatbot workbench application. */
export class ChatbotApiModule extends ConfigurableModuleClass {}
