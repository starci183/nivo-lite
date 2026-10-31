import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./thread-work.module-definition"
import { ThreadTagWakesService } from "./thread-tag-wakes.service"
import { ThreadTagHandlerService } from "./thread-tag-handler.service"
import { ThreadWorkService } from "./thread-work.service"
import { ThreadWorkLinksReadService } from "./thread-work-links-read.service"
import { ThreadWorkTurnsService } from "./thread-work-turns.service"

@Module({})
/**
 * The agents' runtime in work threads (the only writer of thread_work). It composes the work engine and the authority rules of
 * decisions, the thread messages, the module registry and the agents' ownership, all bound by the app root.
 */
export class ThreadWorkModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ThreadWorkTurnsService,
                ThreadWorkService,
                ThreadWorkLinksReadService,
                ThreadTagHandlerService,
                ThreadTagWakesService,
            ],
            exports: [ThreadWorkService, ThreadWorkLinksReadService, ThreadTagHandlerService],
        }
    }
}
