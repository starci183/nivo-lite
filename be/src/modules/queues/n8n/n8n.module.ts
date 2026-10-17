import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./n8n.module-definition"
import { N8nQueue } from "./n8n.queue"

@Module({ providers: [N8nQueue], exports: [N8nQueue] })
/** The n8n queue: its typed producer, imported by the domain module whose service enqueues. */
export class N8nQueueModule extends ConfigurableModuleClass {}
