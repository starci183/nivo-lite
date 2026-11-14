import { Module, type DynamicModule } from "@nestjs/common"
import { Json2VideoComposeService } from "./json2video-compose.service"
import { Json2VideoConnectionFieldsService } from "./json2video-connection-fields.service"
import { Json2VideoCredentialService } from "./json2video-credential.service"
import { Json2VideoProviderRegistrationService } from "./json2video-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./json2video-provider.module-definition"

const PROVIDERS = [Json2VideoCredentialService, Json2VideoComposeService, Json2VideoConnectionFieldsService]

@Module({})
/**
 * Everything JSON2Video-specific that core asks a provider for: the compose port of `nivo.tool.video.compose` / `.render.get`,
 * registered in the compose registry. The app imports the JSON2Video integration (`Json2VideoModule`) and `VideoComposeModule` beside it
 * and lists `Json2VideoConnectionFieldsService` among the connection form writers.
 */
export class Json2VideoProviderModule extends ConfigurableModuleClass {
    /** Registers the app's JSON2Video provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...PROVIDERS, Json2VideoProviderRegistrationService],
            exports: PROVIDERS,
        }
    }
}
