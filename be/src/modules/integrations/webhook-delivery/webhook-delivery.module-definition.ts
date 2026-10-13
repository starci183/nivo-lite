import { ConfigurableModuleBuilder } from "@nestjs/common"
import { WEBHOOK_DELIVERY_OPTIONS } from "./webhook-delivery.decorators"
import type { WebhookDeliveryOptions } from "./webhook-delivery.options"

/** The configurable-module base of the webhook-delivery integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<WebhookDeliveryOptions>({ optionsInjectionToken: WEBHOOK_DELIVERY_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
