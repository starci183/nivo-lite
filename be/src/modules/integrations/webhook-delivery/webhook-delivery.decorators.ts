import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { WebhookDeliveryClient } from "./webhook-delivery.client"
import type { WebhookDeliveryOptions } from "./webhook-delivery.options"

/** Token of the options of the webhook-delivery integration, exported so a spec can provide it. */
export const WEBHOOK_DELIVERY_OPTIONS: unique symbol = Symbol("integrations.webhook-delivery.options")

/** Token of the webhook-delivery client. */
export const WEBHOOK_DELIVERY_CLIENT: unique symbol = Symbol("integrations.webhook-delivery.client")

/** Injects the options of the webhook-delivery integration. Parameter type: WebhookDeliveryOptions. */
export const InjectWebhookDeliveryOptions = (): TypedParameterDecorator<WebhookDeliveryOptions> =>
    injector<WebhookDeliveryOptions>(WEBHOOK_DELIVERY_OPTIONS)

/** Injects the webhook-delivery client. Parameter type: WebhookDeliveryClient. */
export const InjectWebhookDeliveryClient = (): TypedParameterDecorator<WebhookDeliveryClient> =>
    injector<WebhookDeliveryClient>(WEBHOOK_DELIVERY_CLIENT)
