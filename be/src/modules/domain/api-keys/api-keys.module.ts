import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ApiKeysService } from "./api-keys.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./api-keys.module-definition"

@Module({})
/** The api-keys capability over the primary Supabase PostgreSQL connection: workspace API keys, their admission and their rate limit. */
export class ApiKeysModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ApiKeysService], exports: [ApiKeysService] }
    }
}
