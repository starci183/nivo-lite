import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./provider-registry.module-definition"
import {
    BankFeedPollerRegistryService,
    BankTransactionsRegistryService,
    FeedWebhookRegistryService,
    LedgerRegistryService,
    MessageInboxPollerRegistryService,
    PaymentInstructionRegistryService,
} from "./provider-registries.service"

@Module({})
/** The places a provider module registers what it can do, so core code asks a capability and never names a provider. */
export class ProviderRegistryModule extends ConfigurableModuleClass {
    /** Registers the registries once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const registries = [
            BankFeedPollerRegistryService,
            PaymentInstructionRegistryService,
            BankTransactionsRegistryService,
            FeedWebhookRegistryService,
            LedgerRegistryService,
            MessageInboxPollerRegistryService,
        ]
        return { ...base, providers: [...(base.providers ?? []), ...registries], exports: registries }
    }
}
