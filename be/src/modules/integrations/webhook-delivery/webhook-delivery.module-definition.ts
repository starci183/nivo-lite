import { defineCapabilityModule } from "@starci/nest-kit"
import { WEBHOOK_DELIVERY_OPTIONS } from "./webhook-delivery.decorators"
import type { WebhookDeliveryOptions } from "./webhook-delivery.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<WebhookDeliveryOptions>({
    optionsInjectionToken: WEBHOOK_DELIVERY_OPTIONS,
})
