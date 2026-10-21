import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the webhook-delivery integration. */
export enum WebhookDeliveryErrorCode {
    /** The tenant-supplied address cannot be used as a delivery target; the `reason` param says why. */
    TargetRefused = "WEBHOOK_DELIVERY_TARGET_REFUSED",
}

/** How each webhook-delivery code travels. */
export const WEBHOOK_DELIVERY_ERROR_KINDS: Record<WebhookDeliveryErrorCode, ErrorKind> = {
    [WebhookDeliveryErrorCode.TargetRefused]: "invalid",
}

/** The one error class of the webhook-delivery integration. */
export class WebhookDeliveryError extends DomainError<WebhookDeliveryErrorCode> {}
