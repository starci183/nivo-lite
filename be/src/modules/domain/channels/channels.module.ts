import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CHANNEL_SENDER_REGISTRY } from "./channels.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./channels.module-definition"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ChannelSenderRegistryService } from "./channel-sender-registry.service"
import { ChannelDeliveryService } from "./channel-delivery.service"
import { ConnectionHealthService } from "./connection-health.service"
import { TelegramProofService } from "./telegram-proof.service"
import { ZaloProofService } from "./zalo-proof.service"
import { ZaloWizardService } from "./zalo-wizard.service"

@Module({})
/** Delivery to the customer channel, the Zalo token lifecycle, the connection health check and the webhook proofs of the messaging channels. */
export class ChannelsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ZaloCredentialsService, ChannelSenderRegistryService, ChannelDeliveryService, ConnectionHealthService, TelegramProofService, ZaloProofService, ZaloWizardService, { provide: CHANNEL_SENDER_REGISTRY, useExisting: ChannelSenderRegistryService }],
            exports: [ZaloCredentialsService, ZaloWizardService, ChannelDeliveryService, ConnectionHealthService, CHANNEL_SENDER_REGISTRY],
        }
    }
}
