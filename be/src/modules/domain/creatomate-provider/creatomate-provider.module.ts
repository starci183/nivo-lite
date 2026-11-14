import { Module, type DynamicModule } from "@nestjs/common"
import { CreatomateComposeService } from "./creatomate-compose.service"
import { CreatomateConnectionFieldsService } from "./creatomate-connection-fields.service"
import { CreatomateCredentialService } from "./creatomate-credential.service"
import { CreatomateSandboxComposeService } from "./creatomate-sandbox-compose.service"
import { CreatomateProviderRegistrationService } from "./creatomate-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./creatomate-provider.module-definition"

const PROVIDERS = [CreatomateCredentialService, CreatomateComposeService, CreatomateConnectionFieldsService]
const SANDBOX = [CreatomateSandboxComposeService]

@Module({})
/**
 * Everything Creatomate-specific that core asks a provider for: the video compose port (`nivo.tool.video.compose`, `.render.get`),
 * registered with `VideoComposeRegistryService`. The app imports the Creatomate integration (`CreatomateModule`) and `VideoComposeModule`
 * beside it and lists `CreatomateConnectionFieldsService` among the connection form writers.
 */
export class CreatomateProviderModule extends ConfigurableModuleClass {
    /** Registers the app Creatomate provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...PROVIDERS, ...SANDBOX, CreatomateProviderRegistrationService],
            exports: PROVIDERS,
        }
    }
}
