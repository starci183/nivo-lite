import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./connection-poll.module-definition"
import { POLL_EXPORTED, pollProvidersOf } from "./poll-providers.policy"

@Module({})
/**
 * The adaptive poll of connections for any provider that registers a source: the per-connection schedule, the limiter, the breaker and the tick that
 * polls what is due. Providers register through `PollSourceRegistryService`; other modules call `PollScheduleService.markHot` and `recordWebhook`.
 */
export class ConnectionPollModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...pollProvidersOf(options)],
            exports: [...POLL_EXPORTED],
        }
    }
}
