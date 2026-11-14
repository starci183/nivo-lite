import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./thread-deadline.module-definition"
import { ThreadDeadlineQueue } from "./thread-deadline.queue"

@Module({
    providers: [ThreadDeadlineQueue],
    exports: [ThreadDeadlineQueue],
})
/** The thread-deadline queue: its typed producer, imported by the one domain module that owns it (agent-threads). */
export class ThreadDeadlineQueueModule extends ConfigurableModuleClass {}
