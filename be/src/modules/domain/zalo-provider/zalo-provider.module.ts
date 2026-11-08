import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { MessageInboxPollerRegistryService } from "@modules/domain/provider-registry"
import { MessageInboxPollSourcesService } from "./message-inbox-poll-sources.service"
import { ZaloInboxPollerService } from "./zalo-inbox-poller.service"
import { ZaloInboxPollTriggerService } from "./zalo-poll-trigger.service"
import { ZaloInboxPollService } from "./zalo-poll.service"
import { ZaloProfileService } from "./zalo-profile.service"
import { ZaloReconcileService } from "./zalo-reconcile.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./zalo-provider.module-definition"

const PROVIDERS = [
    ZaloInboxPollerService,
    ZaloInboxPollService,
    ZaloInboxPollTriggerService,
    MessageInboxPollSourcesService,
    ZaloProfileService,
    ZaloReconcileService,
]

@Module({})
/**
 * Everything Zalo-specific that core asks a provider for, registered under the capability names: the inbox poller that reads the customer messages
 * the webhook never delivered, with the limits and error classes the scheduler needs, and the first poll of a connection that just became ready.
 */
export class ZaloProviderModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        private readonly pollers: MessageInboxPollerRegistryService,
        private readonly poller: ZaloInboxPollerService,
    ) {
        super()
    }

    /** Registers the app's Zalo provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ...PROVIDERS], exports: PROVIDERS }
    }

    /** Hands the inbox poller to its registry. */
    onModuleInit(): void {
        this.pollers.register(this.poller)
    }
}
