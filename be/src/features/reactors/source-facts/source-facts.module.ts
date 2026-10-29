import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./source-facts.module-definition"
import { QueueSourceFactsHandler } from "./application/queue-source-facts.handler"

@Module({ providers: [QueueSourceFactsHandler] })
/** The source-facts reactor: the handlers its consumers dispatch to. */
export class SourceFactsModule extends ConfigurableModuleClass {}
