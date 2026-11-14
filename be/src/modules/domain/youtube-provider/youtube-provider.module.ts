import { Module, type DynamicModule } from "@nestjs/common"
import { YoutubeCredentialService } from "./youtube-credential.service"
import { YoutubeProviderRegistrationService } from "./youtube-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./youtube-provider.module-definition"
import { YoutubeVideoService } from "./youtube-video.service"

const PROVIDERS = [YoutubeCredentialService, YoutubeVideoService]

@Module({})
/**
 * Everything YouTube-specific that core asks a provider for: the YouTube destination (`nivo.tool.youtube.video.*`), served by the Google
 * account. The app imports the YouTube integration (`YoutubeModule`) and the Google connections (which must export `GoogleTokensService`)
 * beside it, and binds `PUBLISH_FILE_SOURCE` to the generic file store.
 */
export class YoutubeProviderModule extends ConfigurableModuleClass {
    /** Registers the app's YouTube provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...PROVIDERS, YoutubeProviderRegistrationService],
            exports: PROVIDERS,
        }
    }
}
