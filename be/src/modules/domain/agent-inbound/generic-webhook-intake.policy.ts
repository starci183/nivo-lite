import type { AccountDelivery } from "@modules/domain/account-data"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import type { GenericWebhookPayload } from "@modules/queues/generic-webhook"
import { webhookDelivery } from "./webhook.data-types"

/**
 * The key an endpoint's account keeps a delivery under: the delivery id without its `<endpoint>:` prefix; an id of another form (the
 * opaque digest of a long key) is kept whole.
 */
export const webhookKeyOf = (connectionId: string, deliveryId: string): string => {
    const prefix = `${connectionId}:`
    const own = deliveryId.startsWith(prefix) ? deliveryId.slice(prefix.length) : deliveryId
    return own === "" ? deliveryId : own
}

/** A delivery body as the account keeps it: the parsed JSON object (the door refuses any other body), else `{ text: <the body> }`. */
const rawOf = (rawBody: string): object => {
    const read = parseJsonText(rawBody)
    return read.ok && isRecord(read.value) && !Array.isArray(read.value) ? read.value : { text: rawBody }
}

/** The delivery of a generic webhook as the account's intake claims it: the endpoint's connection and its one `webhook.delivery` row. */
export const webhookDeliveryOf = (payload: GenericWebhookPayload): AccountDelivery => ({
    connectionId: payload.connectionId,
    type: webhookDelivery.name,
    value: {
        deliveryId: webhookKeyOf(payload.connectionId, payload.deliveryId),
        ...(payload.eventType === null ? {} : { eventType: payload.eventType }),
        ...(payload.deliveryKey === null ? {} : { deliveryKey: payload.deliveryKey }),
        raw: rawOf(payload.rawBody),
    },
})
