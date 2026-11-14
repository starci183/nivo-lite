import { Module, type DynamicModule } from "@nestjs/common"
import { InetDomainRegistrarService } from "./inet-domain-registrar.service"
import { InetSandboxRegistrarService } from "./inet-sandbox-registrar.service"
import { InetProviderRegistrationService } from "./inet-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inet-provider.module-definition"

@Module({})
/**
 * Everything iNET-specific that core asks a provider for, registered under the capability names: the domain registrar purposes the
 * generic domain tools (`nivo.tool.domain.*`) run through. It needs the iNET client (`InetModule`), the connection tokens and the
 * provider registry, registered globally by the app.
 */
export class InetProviderModule extends ConfigurableModuleClass {
    /** Registers the app's iNET provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), InetDomainRegistrarService, InetSandboxRegistrarService, InetProviderRegistrationService],
            exports: [InetDomainRegistrarService],
        }
    }
}
