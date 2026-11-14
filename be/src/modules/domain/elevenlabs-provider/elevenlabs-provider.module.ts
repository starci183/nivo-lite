import { Module, type DynamicModule } from "@nestjs/common"
import { ElevenLabsConnectionFieldsService } from "./elevenlabs-connection-fields.service"
import { ElevenLabsCredentialService } from "./elevenlabs-credential.service"
import { ElevenLabsMediaService } from "./elevenlabs-media.service"
import { ElevenLabsSandboxMediaService } from "./elevenlabs-sandbox-media.service"
import { ElevenLabsProviderRegistrationService } from "./elevenlabs-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./elevenlabs-provider.module-definition"

const PROVIDERS = [ElevenLabsCredentialService, ElevenLabsMediaService, ElevenLabsConnectionFieldsService]

@Module({})
/**
 * Everything ElevenLabs-specific that core asks a provider for, registered under the capability names: speech (`nivo.tool.speech.*`),
 * dubbing (`nivo.tool.dubbing.*`) and its files. The app imports the ElevenLabs integration (`ElevenLabsModule`) beside it and lists
 * `ElevenLabsConnectionFieldsService` among the connection form writers.
 */
export class ElevenLabsProviderModule extends ConfigurableModuleClass {
    /** Registers the app's ElevenLabs provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...PROVIDERS, ElevenLabsSandboxMediaService, ElevenLabsProviderRegistrationService],
            exports: PROVIDERS,
        }
    }
}
