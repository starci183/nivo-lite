import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { WEBHOOK_DELIVERY_OPTIONS } from "./webhook-delivery.decorators"
import type { WebhookDeliveryOptions } from "./webhook-delivery.options"

/** The configurable-module base of the webhook-delivery integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<WebhookDeliveryOptions>({
    optionsInjectionToken: WEBHOOK_DELIVERY_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WebhookDeliveryOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: WebhookDeliveryOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
