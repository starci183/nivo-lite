import { Module } from "@nestjs/common"
import { ThreadDeadlineQueue } from "./thread-deadline.queue"

@Module({
    providers: [ThreadDeadlineQueue],
    exports: [ThreadDeadlineQueue],
})
/** The thread-deadline queue: its typed producer, imported by the one domain module that owns it (agent-threads). */
export class ThreadDeadlineQueueModule {}
