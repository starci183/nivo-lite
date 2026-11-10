import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import {
    CHANNEL_SENDER_REGISTRY,
    CHANNELS_COLLAGE_STORAGE,
    CHANNELS_IMAGE,
    CHANNELS_PUBLIC_API_URL,
    ZALO_INBOX_READS,
} from "./channels.decorators"
import { ChannelCollageService } from "./channel-collage.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./channels.module-definition"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ChannelSenderRegistryService } from "./channel-sender-registry.service"
import { ChannelCustomerProfileService } from "./channel-customer-profile.service"
import { ChannelDeliveryService } from "./channel-delivery.service"
import { TelegramPicturesService } from "./telegram-pictures.service"
import { ZaloPicturesService } from "./zalo-pictures.service"
import { ChatSendNativeService } from "./chat-send-native.service"
import { ChannelPlanNoticeService } from "./channel-plan-notice.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"
import { ConnectionHealthService } from "./connection-health.service"
import { TelegramProofService } from "./telegram-proof.service"
import { ZaloProofService } from "./zalo-proof.service"
import { ZaloWebhookGateService } from "./zalo-webhook-gate.service"
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
                ChannelCollageService,
                ZaloPicturesService,
                TelegramPicturesService,
                ChannelSenderRegistryService,
                ChannelDeliveryService,
                ChannelCustomerProfileService,
                ChatSendNativeService,
                ChannelPlanNoticeService,
                ZaloDeliveryService,
                ConnectionHealthService,
                TelegramProofService,
                ZaloProofService,
                ZaloWebhookGateService,
                ZaloWizardService,
                ZaloConnectService,
                ZaloPageService,
                TelegramPageService,
                { provide: CHANNEL_SENDER_REGISTRY, useExisting: ChannelSenderRegistryService },
                { provide: ZALO_INBOX_READS, useExisting: options.ports.inbox },
                { provide: CHANNELS_IMAGE, useExisting: options.image },
                { provide: CHANNELS_COLLAGE_STORAGE, useExisting: options.storage },
                { provide: CHANNELS_PUBLIC_API_URL, useValue: options.publicApiUrl ?? "" },
            ],
            exports: [
                ZaloCredentialsService,
                ZaloWebhookGateService,
                ZaloWizardService,
                ZaloConnectService,
                ZaloPageService,
                TelegramPageService,
                ChannelDeliveryService,
                ChannelCollageService,
                ChatSendNativeService,
                ConnectionHealthService,
                CHANNEL_SENDER_REGISTRY,
            ],
        }
    }
}
