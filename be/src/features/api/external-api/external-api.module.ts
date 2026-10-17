import { Module } from "@nestjs/common"
import { AddKnowledgeHandler } from "./application/add-knowledge.handler"
import { ListEventsHandler } from "./application/list-events.handler"
import { ListLeadsHandler } from "./application/list-leads.handler"
import { SendMessageHandler } from "./application/send-message.handler"
import { SubmitLeadHandler } from "./application/submit-lead.handler"
import { ConfigurableModuleClass } from "./external-api.module-definition"

@Module({
    providers: [AddKnowledgeHandler, ListEventsHandler, ListLeadsHandler, SendMessageHandler, SubmitLeadHandler],
})
/** The external API feature: the handlers of its application. */
export class ExternalApiModule extends ConfigurableModuleClass {}
