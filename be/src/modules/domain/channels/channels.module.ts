import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CHANNEL_SENDER_REGISTRY } from "./channels.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./channels.module-definition"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ChannelSenderRegistryService } from "./channel-sender-registry.service"
import { ChannelDeliveryService } from "./channel-delivery.service"
import { TelegramProofService } from "./telegram-proof.service"
import { ZaloProofService } from "./zalo-proof.service"

@Module({})
/** Delivery to the customer's channel, the Zalo token lifecycle and the webhook proofs of the messaging channels. */
export class ChannelsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ZaloCredentialsService, ChannelSenderRegistryService, ChannelDeliveryService, TelegramProofService, ZaloProofService, { provide: CHANNEL_SENDER_REGISTRY, useExisting: ChannelSenderRegistryService }],
            exports: [ZaloCredentialsService, ChannelDeliveryService, CHANNEL_SENDER_REGISTRY],
        }
    }
}
