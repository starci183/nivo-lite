import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./knowledge-progress-sse.module-definition"
import { KnowledgeProgressController } from "./knowledge-progress.controller"

@Module({ controllers: [KnowledgeProgressController] })
/** The server-sent-events transport of the knowledge-progress channel: one authenticated stream per workspace member. */
export class KnowledgeProgressSseModule extends ConfigurableModuleClass {}
