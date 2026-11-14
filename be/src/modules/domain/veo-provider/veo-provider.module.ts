import { Module, type DynamicModule } from "@nestjs/common"
import { VeoConnectionFieldsService } from "./veo-connection-fields.service"
import { VeoCredentialService } from "./veo-credential.service"
import { VeoProviderRegistrationService } from "./veo-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./veo-provider.module-definition"
import { VeoVideoService } from "./veo-video.service"

const PROVIDERS = [VeoCredentialService, VeoVideoService, VeoConnectionFieldsService]

@Module({})
/**
 * Everything Veo-specific that core asks a provider for, registered under the capability names: video generation (`nivo.tool.video.*`)
 * and its files. The app imports the Veo integration (`VeoModule`) beside it and lists `VeoConnectionFieldsService` among the
 * connection form writers.
 */
export class VeoProviderModule extends ConfigurableModuleClass {
    /** Registers the app's Veo provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...PROVIDERS, VeoProviderRegistrationService],
            exports: PROVIDERS,
        }
    }
}
