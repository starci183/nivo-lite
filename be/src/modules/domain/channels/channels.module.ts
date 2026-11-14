import { Module, type DynamicModule } from "@nestjs/common"
import { ZALO_INBOX_READS } from "./channels.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./channels.module-definition"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ChannelDeliveryService } from "./channel-delivery.service"
import { TelegramPicturesService } from "./telegram-pictures.service"
import { ZaloPicturesService } from "./zalo-pictures.service"
import { CustomerProfileNativeService } from "./customer-profile-native.service"
import { CustomerMessageNativeService } from "./customer-message-native.service"
import { ChannelPlanNoticeService } from "./channel-plan-notice.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"
import { CustomerSendRegistryService } from "./customer-send-registry.service"
import { ZaloCustomerSendService } from "./zalo-customer-send.service"
import { TelegramCustomerSendService } from "./telegram-customer-send.service"
import { ConnectionHealthService } from "./connection-health.service"
import { TelegramProofService } from "./telegram-proof.service"
import { ZaloProofService } from "./zalo-proof.service"
import { ZaloWebhookGateService } from "./zalo-webhook-gate.service"
import { ZaloConnectService } from "./zalo-connect.service"
import { ZaloConnectionFieldsService } from "./zalo-connection-fields.service"
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
                ZaloPicturesService,
                TelegramPicturesService,
                ChannelDeliveryService,
                CustomerMessageNativeService,
                CustomerProfileNativeService,
                ChannelPlanNoticeService,
                ZaloDeliveryService,
                ZaloCustomerSendService,
                TelegramCustomerSendService,
                CustomerSendRegistryService,
                ConnectionHealthService,
                TelegramProofService,
                ZaloProofService,
                ZaloWebhookGateService,
                ZaloWizardService,
                ZaloConnectService,
                ZaloConnectionFieldsService,
                ZaloPageService,
                TelegramPageService,
                { provide: ZALO_INBOX_READS, useExisting: options.ports.inbox },
            ],
            exports: [
                ZaloCredentialsService,
                ZaloWebhookGateService,
                ZaloWizardService,
                ZaloConnectService,
                ZaloConnectionFieldsService,
                ZaloPageService,
                TelegramPageService,
                ChannelDeliveryService,
                CustomerSendRegistryService,
                ZaloCustomerSendService,
                TelegramCustomerSendService,
                CustomerMessageNativeService,
                CustomerProfileNativeService,
                ConnectionHealthService,
            ],
        }
    }
}
