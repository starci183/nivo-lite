import { Module } from "@nestjs/common"
import type { DynamicModule, OnModuleInit } from "@nestjs/common"
import { MessageInboxPollerRegistry } from "@modules/domain/provider-registry"
import { MessageInboxPollSources } from "./message-inbox-poll-sources.service"
import { ZaloInboxPoller } from "./zalo-inbox-poller.service"
import { ZaloInboxPollTriggerService } from "./zalo-poll-trigger.service"
import { ZaloInboxPollService } from "./zalo-poll.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./zalo-provider.module-definition"

const PROVIDERS = [ZaloInboxPoller, ZaloInboxPollService, ZaloInboxPollTriggerService, MessageInboxPollSources]

@Module({})
/**
 * Everything Zalo-specific that core asks a provider for, registered under the capability names: the inbox poller that reads the customer messages
 * the webhook never delivered, with the limits and error classes the scheduler needs, and the first poll of a connection that just became ready.
 */
export class ZaloProviderModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        private readonly pollers: MessageInboxPollerRegistry,
        private readonly poller: ZaloInboxPoller,
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
