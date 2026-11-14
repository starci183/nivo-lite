import { Module, type DynamicModule } from "@nestjs/common"
import { TiktokConnectionFieldsService } from "./tiktok-connection-fields.service"
import { TiktokCredentialService } from "./tiktok-credential.service"
import { TiktokProviderRegistrationService } from "./tiktok-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./tiktok-provider.module-definition"
import { TiktokSandboxVideoService } from "./tiktok-sandbox-video.service"
import { TiktokVideoService } from "./tiktok-video.service"

const PROVIDERS = [TiktokCredentialService, TiktokVideoService, TiktokConnectionFieldsService]

@Module({})
/**
 * Everything TikTok-specific that core asks a provider for, registered under the destination's registry: publishing to TikTok
 * (`nivo.tool.tiktok.*`). The app imports the TikTok integration (`TiktokModule`) beside it and lists `TiktokConnectionFieldsService`
 * among the connection form writers.
 */
export class TiktokProviderModule extends ConfigurableModuleClass {
    /** Registers the app's TikTok provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...PROVIDERS, TiktokSandboxVideoService, TiktokProviderRegistrationService],
            exports: PROVIDERS,
        }
    }
}
