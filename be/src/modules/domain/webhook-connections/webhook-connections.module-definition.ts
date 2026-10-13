import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"

/** The configurable-module base of the webhook-connections capability. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<WebhookConnectionsOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
