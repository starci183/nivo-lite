import { Module } from "@nestjs/common"
import { AddKnowledgeHandler } from "./application/add-knowledge.handler"
import { ListEventsHandler } from "./application/list-events.handler"
import { SendMessageHandler } from "./application/send-message.handler"
import { ConfigurableModuleClass } from "./external-api.module-definition"

@Module({
    providers: [AddKnowledgeHandler, ListEventsHandler, SendMessageHandler],
})
/** The external API feature: the handlers of its application. */
export class ExternalApiModule extends ConfigurableModuleClass {}
