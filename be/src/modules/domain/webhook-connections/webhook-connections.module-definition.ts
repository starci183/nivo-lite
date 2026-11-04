import { defineCapabilityModule } from "@starci/nest-kit"
import { WEBHOOK_CONNECTIONS_OPTIONS } from "./webhook-connections.decorators"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineCapabilityModule<WebhookConnectionsOptions>({
        optionsInjectionToken: WEBHOOK_CONNECTIONS_OPTIONS,
    })
