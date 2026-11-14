import { Module, type DynamicModule } from "@nestjs/common"
import { ApiKeyOwnerService } from "./api-key-owner.service"
import { ApiKeysService } from "./api-keys.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./api-keys.module-definition"
import { API_KEYS_OPTIONS } from "./api-keys.port"

@Module({})
/** The api-keys capability over the primary PostgreSQL connection: workspace API keys, their admission and their rate limit. */
export class ApiKeysModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: API_KEYS_OPTIONS, useValue: { mcpPublicUrl: options.mcpPublicUrl } },
                ApiKeysService,
                ApiKeyOwnerService,
            ],
            exports: [ApiKeysService, ApiKeyOwnerService],
        }
    }
}
