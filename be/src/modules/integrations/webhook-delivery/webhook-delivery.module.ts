import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { WebhookDeliveryClient } from "./webhook-delivery.client"
import { WEBHOOK_DELIVERY_CLIENT } from "./webhook-delivery.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./webhook-delivery.module-definition"

@Module({})
/** Provides the webhook-delivery client. */
export class WebhookDeliveryModule extends ConfigurableModuleClass {
    /** Registers the integration once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: WEBHOOK_DELIVERY_CLIENT, useClass: WebhookDeliveryClient },
            ],
            exports: [WEBHOOK_DELIVERY_CLIENT],
        }
    }
}
