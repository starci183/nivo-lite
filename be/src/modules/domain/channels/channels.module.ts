import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CHANNEL_SENDER_REGISTRY, ZALO_INBOX_READS } from "./channels.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./channels.module-definition"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ChannelSenderRegistryService } from "./channel-sender-registry.service"
import { ChannelDeliveryService } from "./channel-delivery.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"
import { ConnectionHealthService } from "./connection-health.service"
import { TelegramProofService } from "./telegram-proof.service"
import { ZaloProofService } from "./zalo-proof.service"
import { ZaloConnectService } from "./zalo-connect.service"
import { ZaloWizardService } from "./zalo-wizard.service"
import { ZaloPageService } from "./zalo-page.service"
import { TelegramPageService } from "./telegram-page.service"

@Module({})
/** Delivery to the customer channel, the Zalo token lifecycle, the connection health check and the webhook proofs of the messaging channels. */
export class ChannelsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ZaloCredentialsService,
                ChannelSenderRegistryService,
                ChannelDeliveryService,
                ZaloDeliveryService,
                ConnectionHealthService,
                TelegramProofService,
                ZaloProofService,
                ZaloWizardService,
                ZaloConnectService,
                ZaloPageService,
                TelegramPageService,
                { provide: CHANNEL_SENDER_REGISTRY, useExisting: ChannelSenderRegistryService },
                { provide: ZALO_INBOX_READS, useExisting: options.ports.inbox },
            ],
            exports: [
                ZaloCredentialsService,
                ZaloWizardService,
                ZaloConnectService,
                ZaloPageService,
                TelegramPageService,
                ChannelDeliveryService,
                ConnectionHealthService,
                CHANNEL_SENDER_REGISTRY,
            ],
        }
    }
}
