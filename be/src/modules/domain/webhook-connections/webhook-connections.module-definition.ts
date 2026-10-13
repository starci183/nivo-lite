import { ConfigurableModuleBuilder } from "@nestjs/common"
import { WEBHOOK_CONNECTIONS_OPTIONS } from "./webhook-connections.decorators"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"

/** The configurable-module base of the webhook-connections capability. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<WebhookConnectionsOptions>({ optionsInjectionToken: WEBHOOK_CONNECTIONS_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
