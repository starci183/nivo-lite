import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { WEBHOOK_CONNECTIONS_OPTIONS } from "./webhook-connections.decorators"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"

/** The configurable-module base of the webhook-connections capability. */
const definition = new ConfigurableModuleBuilder<WebhookConnectionsOptions>({
    optionsInjectionToken: WEBHOOK_CONNECTIONS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WebhookConnectionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: WebhookConnectionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
