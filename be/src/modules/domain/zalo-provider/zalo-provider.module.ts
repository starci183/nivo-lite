import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { CustomerSendRegistryService, ZaloCustomerSendService } from "@modules/domain/channels"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { ChannelProfileRegistryService, MessageInboxPollerRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { ZALO_ACCESS_TOKENS } from "./zalo-access-tokens.port"
import { ZaloInboxPollerService } from "./zalo-inbox-poller.service"
import { ZALO_TRIGGERS } from "./zalo-message.trigger"
import { ZaloProfileReaderService } from "./zalo-profile-reader.service"
import { ZALO_SANDBOX_CATALOGUE } from "./zalo-sandbox.catalogue"
import { ZALO_SEND_SANDBOX_CASES, ZALO_STAFF_SANDBOX_CASES } from "./zalo-sandbox-send.catalogue"
import { ZaloSandboxSendService } from "./zalo-sandbox-send.service"
import { ZaloSandboxInboxPollerService } from "./zalo-sandbox-inbox-poller.service"
import { ZaloSandboxProfileService } from "./zalo-sandbox-profile.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./zalo-provider.module-definition"

@Module({})
/**
 * The Zalo OA provider's faces, registered once at boot: its trigger (`zalo.message.received`, a pure translate of the stored event row)
 * its poll face, the reader that reads back the customer messages the webhook never delivered, with the limits and error classes the
 * scheduler needs, and its profile read (name and picture of a customer), its customer SEND (the live Zalo route and its sandbox twin, registered on the customer-send registry), which the provider-neutral profile tool reaches by the registry. It keeps nothing: the intake keeps every event, the engine meets the person.
 */
export class ZaloProviderModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        private readonly pollers: MessageInboxPollerRegistryService,
        private readonly poller: ZaloInboxPollerService,
        private readonly profiles: ChannelProfileRegistryService,
        private readonly profileReader: ZaloProfileReaderService,
        private readonly pollerSandbox: ZaloSandboxInboxPollerService,
        private readonly profileSandbox: ZaloSandboxProfileService,
        private readonly catalogues: SandboxCatalogueRegistryService,
        private readonly sends: CustomerSendRegistryService,
        private readonly sendLive: ZaloCustomerSendService,
        private readonly sendSandbox: ZaloSandboxSendService,
    ) {
        super()
    }

    /** Registers the app's Zalo provider once; the app root names the class behind its token port. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ZaloInboxPollerService,
                ZaloProfileReaderService,
                ZaloSandboxInboxPollerService,
                ZaloSandboxProfileService,
                ZaloSandboxSendService,
                { provide: ZALO_ACCESS_TOKENS, useExisting: options.ports.tokens },
            ],
            exports: [ZaloInboxPollerService, ZaloProfileReaderService],
        }
    }

    /** Hands the inbox poller and the profile read, each with its sandbox twin, to their registries, the sandbox catalogue to its registry and the trigger declarations to theirs. */
    onModuleInit(): void {
        this.pollers.register({ live: this.poller, sandbox: this.pollerSandbox })
        this.profiles.register({ live: this.profileReader, sandbox: this.profileSandbox })
        this.sends.register({ live: this.sendLive, sandbox: this.sendSandbox })
        this.catalogues.register(ZALO_SANDBOX_CATALOGUE)
        this.catalogues.register({ provider: ZALO_SANDBOX_CATALOGUE.provider, cases: [...ZALO_SEND_SANDBOX_CASES, ...ZALO_STAFF_SANDBOX_CASES] })
        triggerDeclarations.register(...ZALO_TRIGGERS)
    }
}
