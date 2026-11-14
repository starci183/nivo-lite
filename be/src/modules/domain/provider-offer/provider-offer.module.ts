import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./provider-offer.module-definition"
import { ProviderOfferService } from "./provider-offer.service"

@Module({})
/**
 * What a provider offers at its three levels, documented from the registries for the provider page. It reads the global
 * capabilities that own those registries (connections, workspace members, the MCP gateway, the interface reads); it owns no table.
 */
export class ProviderOfferModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ProviderOfferService],
            exports: [ProviderOfferService],
        }
    }
}
