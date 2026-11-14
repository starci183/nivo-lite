import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { CustomerSendRegistryService } from "@modules/domain/channels"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { MetaChannelSender } from "./meta-channel-sender.service"
import { MetaConnectionsService } from "./meta-connections.service"
import { MetaCustomerSendService } from "./meta-customer-send.service"
import { META_SANDBOX_CATALOGUE } from "./meta-sandbox.catalogue"
import { META_SEND_SANDBOX_CASES } from "./meta-sandbox-send.catalogue"
import { MetaSandboxSendService } from "./meta-sandbox-send.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta-connections.module-definition"

@Module({})
/**
 * The Facebook Pages and Instagram connection wizard over the connections capability, and the Meta customer send: the live Page sender
 * and its sandbox twin registered together on the customer-send registry, with the Meta sandbox catalogue.
 */
export class MetaConnectionsModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        private readonly sends: CustomerSendRegistryService,
        private readonly sendLive: MetaCustomerSendService,
        private readonly sendSandbox: MetaSandboxSendService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {
        super()
    }

    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                MetaConnectionsService,
                MetaChannelSender,
                MetaCustomerSendService,
                MetaSandboxSendService,
            ],
            exports: [MetaConnectionsService],
        }
    }

    /** Hands the Meta customer send (live and sandbox) to its registry and the Meta sandbox catalogue to its own. */
    onModuleInit(): void {
        this.sends.register({ live: this.sendLive, sandbox: this.sendSandbox })
        this.catalogues.register(META_SANDBOX_CATALOGUE)
        this.catalogues.register({ provider: META_SANDBOX_CATALOGUE.provider, cases: META_SEND_SANDBOX_CASES })
    }
}
