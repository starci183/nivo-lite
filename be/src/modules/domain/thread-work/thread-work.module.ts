import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./thread-work.module-definition"
import { ThreadWorkService } from "./thread-work.service"
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
            providers: [...(base.providers ?? []), ThreadWorkTurnsService, ThreadWorkService],
            exports: [ThreadWorkService],
        }
    }
}
