import { defineAccountDataType, type AccountDataTypeDef } from "@modules/domain/account-data"

/** The provider of a generic webhook endpoint, as `connections.provider` names it. */
export const WEBHOOK_PROVIDER = "webhook"

/** The names of the credential an endpoint holds (the random secret its deliveries are signed with): no delivery value may carry one. */
const WEBHOOK_SECRET_FIELDS: ReadonlyArray<string> = ["webhookSecret", "webhook_secret"]

/**
 * One verified delivery of a generic signed webhook, as the sender posted it (`raw` is the JSON body), with the sender's event type and
 * delivery key headers; keyed by the delivery id without its endpoint, swept after 30 days. It wakes nothing: the generic-webhook queue
 * carries the delivery to the door.
 */
export const webhookDelivery: AccountDataTypeDef = defineAccountDataType({
    name: "webhook.delivery",
    provider: WEBHOOK_PROVIDER,
    version: 1,
    write: "append",
    fields: {
        deliveryId: { type: "text", required: true },
        eventType: { type: "text", required: false, maxLength: 200 },
        deliveryKey: { type: "text", required: false },
        raw: { type: "json", required: true },
    },
    key: ["deliveryId"],
    wakes: false,
    retention: { days: 30 },
    indexes: [],
    secretFields: WEBHOOK_SECRET_FIELDS,
    purpose: "webhook.event",
})

/** Every account data type of a generic webhook endpoint, for the catalog. */
export const WEBHOOK_DATA_TYPES: ReadonlyArray<AccountDataTypeDef> = [webhookDelivery]
