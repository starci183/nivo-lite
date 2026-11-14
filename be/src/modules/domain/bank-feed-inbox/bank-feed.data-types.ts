import { defineAccountDataType, type AccountDataTypeDef } from "@modules/domain/account-data"

/**
 * The names of the credentials a bank-feed connection holds (SePay's API key and webhook key, Casso's API key and secure key, payOS's
 * client id, API key and checksum key), in every spelling the code and the providers' APIs use: no value of a bank-feed type may carry a
 * member of these names.
 */
const BANK_FEED_SECRET_FIELDS: ReadonlyArray<string> = [
    "apiKey",
    "api_key",
    "webhookSecret",
    "webhook_secret",
    "webhookKey",
    "secureKey",
    "secure_key",
    "secureToken",
    "secure_token",
    "checksumKey",
    "checksum_key",
    "credential",
]

/** The longest key of a delivery or a transaction: the longest key a row holds (a longer delivery id arrives hashed). */
const ID_MAX = 400

/** The longest transfer content a row keeps; banks cut theirs far shorter. */
const CONTENT_MAX = 2000

/** One delivery of a bank door's webhook (or the same transaction read back by a poll): the consumer's work row, swept 30 days after it was processed. */
const deliveryOf = (provider: string): AccountDataTypeDef =>
    defineAccountDataType({
        name: `${provider}.delivery`,
        provider,
        version: 1,
        write: "append",
        fields: {
            deliveryId: { type: "text", required: true, maxLength: ID_MAX },
            credits: { type: "json", required: true },
            source: { type: "text", required: false, maxLength: 8 },
        },
        key: ["deliveryId"],
        wakes: true,
        retention: { days: 30 },
        indexes: [],
        secretFields: BANK_FEED_SECRET_FIELDS,
        purpose: "bank.event",
    })

/** One bank movement as the provider reported it, keyed by the provider's own transaction id, kept for good. */
const transactionOf = (provider: string): AccountDataTypeDef =>
    defineAccountDataType({
        name: `${provider}.transaction`,
        provider,
        version: 1,
        write: "append",
        fields: {
            transactionId: { type: "text", required: true, maxLength: ID_MAX },
            amount: { type: "integer", required: true },
            direction: { type: "text", required: true, maxLength: 6 },
            content: { type: "text", required: true, maxLength: CONTENT_MAX },
            account: { type: "text", required: false, maxLength: 64 },
            payer: { type: "text", required: false, maxLength: 256 },
            bankRef: { type: "text", required: false, maxLength: ID_MAX },
            at: { type: "timestamp", required: false },
            source: { type: "text", required: true, maxLength: 8 },
        },
        key: ["transactionId"],
        occurredAt: "at",
        wakes: false,
        retention: "keep",
        indexes: [
            { name: "account", on: ["account"] },
            { name: "bank_ref", on: ["bankRef"] },
        ],
        secretFields: BANK_FEED_SECRET_FIELDS,
        purpose: "bank.transaction",
    })

/** A delivery of a workspace's SePay feed. */
export const sepayDelivery: AccountDataTypeDef = deliveryOf("sepay")

/** A bank movement SePay reported. */
export const sepayTransaction: AccountDataTypeDef = transactionOf("sepay")

/** A delivery of a workspace's Casso feed (one delivery may hold several movements). */
export const cassoDelivery: AccountDataTypeDef = deliveryOf("casso")

/** A bank movement Casso reported. */
export const cassoTransaction: AccountDataTypeDef = transactionOf("casso")

/** A paid-order delivery of a workspace's payOS gateway. */
export const payosDelivery: AccountDataTypeDef = deliveryOf("payos")

/** A payment payOS reported. */
export const payosTransaction: AccountDataTypeDef = transactionOf("payos")

/** Every account data type of a bank-feed connection, for the catalog. */
export const BANK_FEED_DATA_TYPES: ReadonlyArray<AccountDataTypeDef> = [
    cassoDelivery,
    cassoTransaction,
    payosDelivery,
    payosTransaction,
    sepayDelivery,
    sepayTransaction,
]
