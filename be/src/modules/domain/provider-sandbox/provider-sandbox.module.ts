import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./provider-sandbox.module-definition"
import { PROVIDER_SANDBOX_STORE, PROVIDER_SANDBOX_SWITCH, SANDBOX_LOOPBACK_PORT, SANDBOX_WEBHOOK_POSTER } from "./provider-sandbox.decorators"
import { ProviderSandboxAccountsService } from "./provider-sandbox-accounts.service"
import { ProviderSandboxStoreService } from "./provider-sandbox-store.service"
import { ProviderSandboxService } from "./provider-sandbox.service"
import { SandboxCatalogueRegistryService } from "./sandbox-catalogue-registry.service"
import { SandboxLoopbackPosterService } from "./sandbox-loopback-poster.service"
import { SandboxWebhookKeyService } from "./sandbox-webhook-key.service"

@Module({})
/**
 * The provider sandbox (lane concept provider-sandbox): the frame providers' sandbox implementations answer through, the hardcoded
 * catalogues, the one shared guard of a provider webhook for a sandbox account and the doors of the Sandbox page. Register it global.
 */
export class ProviderSandboxModule extends ConfigurableModuleClass {
    /** Registers the capability with the dev switch the app read once (`parseProviderSandboxConfig`) and the api's own port. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: PROVIDER_SANDBOX_SWITCH, useValue: options.sandbox },
                { provide: SANDBOX_LOOPBACK_PORT, useValue: options.loopbackPort },
                SandboxLoopbackPosterService,
                { provide: SANDBOX_WEBHOOK_POSTER, useExisting: SandboxLoopbackPosterService },
                ProviderSandboxStoreService,
                { provide: PROVIDER_SANDBOX_STORE, useExisting: ProviderSandboxStoreService },
                ProviderSandboxService,
                SandboxCatalogueRegistryService,
                SandboxWebhookKeyService,
                ProviderSandboxAccountsService,
            ],
            exports: [ProviderSandboxService, SandboxCatalogueRegistryService, SandboxWebhookKeyService, ProviderSandboxAccountsService, PROVIDER_SANDBOX_STORE],
        }
    }
}
