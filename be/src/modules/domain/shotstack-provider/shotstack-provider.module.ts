import { Module, type DynamicModule } from "@nestjs/common"
import { ShotstackComposeService } from "./shotstack-compose.service"
import { ShotstackConnectionFieldsService } from "./shotstack-connection-fields.service"
import { ShotstackCredentialService } from "./shotstack-credential.service"
import { ShotstackSandboxComposeService } from "./shotstack-sandbox-compose.service"
import { ShotstackProviderRegistrationService } from "./shotstack-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./shotstack-provider.module-definition"

const PROVIDERS = [ShotstackCredentialService, ShotstackComposeService, ShotstackConnectionFieldsService]

@Module({})
/**
 * Everything Shotstack-specific that core asks a provider for, registered under the capability name: cloud video compose
 * (`nivo.tool.video.compose`, `nivo.tool.video.render.get`). The app imports the Shotstack integration (`ShotstackModule`) and the
 * compose capability (`VideoComposeModule`) beside it and lists `ShotstackConnectionFieldsService` among the connection form writers.
 */
export class ShotstackProviderModule extends ConfigurableModuleClass {
    /** Registers the app's Shotstack provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...PROVIDERS, ShotstackSandboxComposeService, ShotstackProviderRegistrationService],
            exports: PROVIDERS,
        }
    }
}
