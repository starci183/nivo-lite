import { Module, type DynamicModule } from "@nestjs/common"
import { TinoDomainRegistrarService } from "./tino-domain-registrar.service"
import { TinoSandboxRegistrarService } from "./tino-sandbox-registrar.service"
import { TinoProviderRegistrationService } from "./tino-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./tino-provider.module-definition"

@Module({})
/**
 * Everything Tino-specific that core asks a provider for, registered under the capability names: the domain registrar purposes the
 * generic domain tools (`nivo.tool.domain.*`) run through. It needs the Tino client (`TinoModule`), the connection tokens and the
 * provider registry, registered globally by the app.
 */
export class TinoProviderModule extends ConfigurableModuleClass {
    /** Registers the app's Tino provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), TinoDomainRegistrarService, TinoSandboxRegistrarService, TinoProviderRegistrationService],
            exports: [TinoDomainRegistrarService],
        }
    }
}
