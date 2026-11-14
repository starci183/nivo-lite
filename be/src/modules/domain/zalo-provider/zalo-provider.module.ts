import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { ChannelProfileRegistryService, MessageInboxPollerRegistryService } from "@modules/domain/provider-registry"
import { ZALO_ACCESS_TOKENS } from "./zalo-access-tokens.port"
import { ZaloInboxPollerService } from "./zalo-inbox-poller.service"
import { ZALO_TRIGGERS } from "./zalo-message.trigger"
import { ZaloProfileReaderService } from "./zalo-profile-reader.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./zalo-provider.module-definition"

@Module({})
/**
 * The Zalo OA provider's faces, registered once at boot: its trigger (`zalo.message.received`, a pure translate of the stored event row)
 * its poll face, the reader that reads back the customer messages the webhook never delivered, with the limits and error classes the
 * scheduler needs, and its profile read (name and picture of a customer), which the provider-neutral profile tool reaches by the registry. It keeps nothing: the intake keeps every event, the engine meets the person.
 */
export class ZaloProviderModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        private readonly pollers: MessageInboxPollerRegistryService,
        private readonly poller: ZaloInboxPollerService,
        private readonly profiles: ChannelProfileRegistryService,
        private readonly profileReader: ZaloProfileReaderService,
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
                { provide: ZALO_ACCESS_TOKENS, useExisting: options.ports.tokens },
            ],
            exports: [ZaloInboxPollerService, ZaloProfileReaderService],
        }
    }

    /** Hands the inbox poller and the profile read to their registries and the trigger declarations to theirs. */
    onModuleInit(): void {
        this.pollers.register(this.poller)
        this.profiles.register(this.profileReader)
        triggerDeclarations.register(...ZALO_TRIGGERS)
    }
}
