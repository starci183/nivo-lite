import { defineAccountDataType, type AccountDataTypeDef } from "@modules/domain/account-data"

/** The provider of every Meta connection, as `connections.provider` names it. */
export const META_PROVIDER = "meta"

/**
 * The names of the credentials a Meta connection holds (the Page token, the user and app tokens of its authorization, the app secret that
 * signs the webhook, the webhook secret), in every spelling the code and the Graph API use: no value of a Meta type may carry a member of
 * these names.
 */
const META_SECRET_FIELDS: ReadonlyArray<string> = [
    "pageToken",
    "page_token",
    "accessToken",
    "access_token",
    "appSecret",
    "app_secret",
    "webhookSecret",
    "webhook_secret",
]

/**
 * One event of a connected Page or Instagram account, as the Meta integration normalised it out of the signed delivery (`raw` is the
 * `MetaEvent`), keyed by its `event_key`: the work row of the consumer, swept 30 days after it was processed.
 */
export const metaEvent: AccountDataTypeDef = defineAccountDataType({
    name: "meta.event",
    provider: META_PROVIDER,
    version: 1,
    write: "append",
    fields: {
        eventKey: { type: "text", required: true },
        raw: { type: "json", required: true },
    },
    key: ["eventKey"],
    wakes: true,
    retention: { days: 30 },
    indexes: [],
    secretFields: META_SECRET_FIELDS,
    purpose: "chat.event",
})

/** One direct message a person sent to the Page or the Instagram account, keyed by the `event_key` of its event, kept for good. */
export const metaMessage: AccountDataTypeDef = defineAccountDataType({
    name: "meta.message",
    provider: META_PROVIDER,
    version: 1,
    write: "append",
    fields: {
        eventKey: { type: "text", required: true },
        mid: { type: "text", required: false, maxLength: 256 },
        platform: { type: "text", required: true, maxLength: 16 },
        userId: { type: "text", required: true, maxLength: 64 },
        direction: { type: "text", required: true, maxLength: 3 },
        text: { type: "text", required: true, maxLength: 8192 },
        at: { type: "timestamp", required: true },
    },
    occurredAt: "at",
    key: ["eventKey"],
    wakes: false,
    retention: "keep",
    indexes: [{ name: "user_id", on: ["userId"] }],
    secretFields: META_SECRET_FIELDS,
    purpose: "chat.message",
})

/** A person who wrote to the Page or the Instagram account, keyed by their page- or Instagram-scoped id, kept for good. */
export const metaUser: AccountDataTypeDef = defineAccountDataType({
    name: "meta.user",
    provider: META_PROVIDER,
    version: 1,
    write: "overwrite",
    fields: {
        userId: { type: "text", required: true, maxLength: 64 },
        platform: { type: "text", required: true, maxLength: 16 },
        name: { type: "text", required: false, maxLength: 256 },
    },
    key: ["userId"],
    wakes: false,
    retention: "keep",
    indexes: [],
    secretFields: META_SECRET_FIELDS,
    purpose: "chat.contact",
})

/** Every account data type of a Meta connection, for the catalog. */
export const META_DATA_TYPES: ReadonlyArray<AccountDataTypeDef> = [metaEvent, metaMessage, metaUser]
