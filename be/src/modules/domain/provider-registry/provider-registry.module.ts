import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./provider-registry.module-definition"
import {
    BankFeedPollerRegistryService,
    BankTransactionsRegistryService,
    ChannelProfileRegistryService,
    DomainRegistrarRegistryService,
    FeedWebhookRegistryService,
    LedgerRegistryService,
    MessageInboxPollerRegistryService,
    PaymentInstructionRegistryService,
} from "./provider-registries.service"
import { PURPOSE_REGISTRIES } from "./media-registries.service"
import { CalendarRegistryService } from "./calendar-registry.service"
import { PaymentLinkRegistryService } from "./payment-link-registry.service"
import { FacebookPublishRegistryService } from "./facebook-publish-registry.service"
import { InstagramPublishRegistryService } from "./instagram-publish-registry.service"
import { TemplateMessageRegistryService } from "./template-message-registry.service"
import { TiktokPublishRegistryService } from "./tiktok-publish-registry.service"
import { YoutubePublishRegistryService } from "./youtube-publish-registry.service"

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
            ...PURPOSE_REGISTRIES,
            CalendarRegistryService,
            PaymentLinkRegistryService,
            FacebookPublishRegistryService,
            InstagramPublishRegistryService,
            YoutubePublishRegistryService,
            TiktokPublishRegistryService,
            TemplateMessageRegistryService,
            DomainRegistrarRegistryService,
            ChannelProfileRegistryService,
        ]
        return { ...base, providers: [...(base.providers ?? []), ...registries], exports: registries }
    }
}
