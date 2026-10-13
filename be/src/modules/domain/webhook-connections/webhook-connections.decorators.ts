import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"

/** Token of the webhook-connections options, exported so a spec can provide it. */
export const WEBHOOK_CONNECTIONS_OPTIONS: unique symbol = Symbol("domain.webhook-connections.options")

/** Injects the options of the webhook-connections capability. Parameter type: WebhookConnectionsOptions. */
export const InjectWebhookConnectionsOptions = (): TypedParameterDecorator<WebhookConnectionsOptions> =>
    injector<WebhookConnectionsOptions>(WEBHOOK_CONNECTIONS_OPTIONS)
