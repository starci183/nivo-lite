import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./decisions.module-definition"
import { DecisionsQueue } from "./decisions.queue"

@Module({ providers: [DecisionsQueue], exports: [DecisionsQueue] })
/** The decisions queue: its typed producer, imported by the module whose service enqueues. */
export class DecisionsQueueModule extends ConfigurableModuleClass {}
