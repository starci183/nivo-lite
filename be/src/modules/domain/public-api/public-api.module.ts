import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { PublicApiQueueModule } from "@modules/queues/public-api"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./public-api.module-definition"
import { PublicApiService } from "./public-api.service"

@Module({})
/** The public-api capability over the primary Supabase PostgreSQL connection; an accepted request enqueues its follow-up work. */
export class PublicApiModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), PublicApiQueueModule],
            providers: [...(base.providers ?? []), PublicApiService],
            exports: [PublicApiService],
        }
    }
}
