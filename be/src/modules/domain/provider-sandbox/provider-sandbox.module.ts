import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./provider-sandbox.module-definition"
import { PROVIDER_SANDBOX_STORE } from "./provider-sandbox.decorators"
import { ProviderSandboxStoreService } from "./provider-sandbox-store.service"
import { ProviderSandboxService } from "./provider-sandbox.service"
import { SandboxWebhookKeyService } from "./sandbox-webhook-key.service"

@Module({})
/** The provider sandbox (lane concept provider-sandbox): the per-account store providers' sandbox implementations answer through, and the one shared guard of a provider webhook for a sandbox account. */
export class ProviderSandboxModule extends ConfigurableModuleClass {
    /** Registers the capability over the primary database. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ProviderSandboxStoreService,
                { provide: PROVIDER_SANDBOX_STORE, useExisting: ProviderSandboxStoreService },
                ProviderSandboxService,
                SandboxWebhookKeyService,
            ],
            exports: [ProviderSandboxService, SandboxWebhookKeyService, PROVIDER_SANDBOX_STORE],
        }
    }
}
