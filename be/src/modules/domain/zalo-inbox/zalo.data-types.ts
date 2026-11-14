import { defineAccountDataType, type AccountDataTypeDef } from "@modules/domain/account-data"

/** The provider of a Zalo OA connection, as `connections.provider` names it. */
export const ZALO_PROVIDER = "zalo_oa"

/**
 * The names of the credentials a Zalo OA connection holds (the app secret, the OA Secret Key that signs the webhook, the access and refresh
 * tokens, the webhook secret), in every spelling the code and Zalo's API use: no value of a Zalo type may carry a member of these names.
 */
const ZALO_SECRET_FIELDS: ReadonlyArray<string> = [
    "appSecret",
    "app_secret",
    "oaSecret",
    "oa_secret_key",
    "accessToken",
    "access_token",
    "renewalToken",
    "refresh_token",
    "webhookSecret",
    "webhook_secret",
]

/**
 * One event of the OA's webhook (or a customer message a reconcile run read back), as Zalo sent it: the work row of the consumer (pending
 * until it is stored and answered), swept 30 days after it was processed. A customer message is keyed by its `msg_id`, so the webhook and
 * the poll bring the same key and whichever comes first is the one row; any other event by its name, time, person and message id, or the
 * digest of its bytes.
 */
export const zaloEvent: AccountDataTypeDef = defineAccountDataType({
    name: "zalo_oa.event",
    provider: ZALO_PROVIDER,
    version: 1,
    write: "append",
    fields: {
        eventId: { type: "text", required: true },
        event: { type: "text", required: false, maxLength: 64 },
        source: { type: "text", required: false, maxLength: 16 },
        raw: { type: "json", required: true },
    },
    key: ["eventId"],
    wakes: true,
    retention: { days: 30 },
    indexes: [],
    secretFields: ZALO_SECRET_FIELDS,
    purpose: "chat.event",
})

/** One customer message to the OA, keyed by Zalo's `msg_id`, kept for good. */
export const zaloMessage: AccountDataTypeDef = defineAccountDataType({
    name: "zalo_oa.message",
    provider: ZALO_PROVIDER,
    version: 1,
    write: "append",
    fields: {
        msgId: { type: "text", required: true, maxLength: 128 },
        userId: { type: "text", required: true, maxLength: 64 },
        direction: { type: "text", required: true, maxLength: 3 },
        text: { type: "text", required: true, maxLength: 8192 },
        at: { type: "timestamp", required: true },
    },
    key: ["msgId"],
    occurredAt: "at",
    wakes: false,
    retention: "keep",
    indexes: [{ name: "user_id", on: ["userId"] }],
    secretFields: ZALO_SECRET_FIELDS,
    purpose: "chat.message",
})

/** A Zalo user of the OA, keyed by their Zalo user id: their name when known, their follow state and the last event they sent, kept for good. */
export const zaloUser: AccountDataTypeDef = defineAccountDataType({
    name: "zalo_oa.user",
    provider: ZALO_PROVIDER,
    version: 1,
    write: "overwrite",
    fields: {
        userId: { type: "text", required: true, maxLength: 64 },
        name: { type: "text", required: false, maxLength: 256 },
        followed: { type: "boolean", required: false },
        lastEvent: { type: "text", required: false, maxLength: 64 },
    },
    key: ["userId"],
    wakes: false,
    retention: "keep",
    indexes: [{ name: "followed", on: ["followed"] }],
    secretFields: ZALO_SECRET_FIELDS,
    purpose: "chat.contact",
})

/** Every account data type of a Zalo OA connection, for the catalog. */
export const ZALO_DATA_TYPES: ReadonlyArray<AccountDataTypeDef> = [zaloEvent, zaloMessage, zaloUser]
