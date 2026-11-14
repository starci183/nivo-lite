import { createHash } from "node:crypto"
import { isRecord } from "@modules/platform/primitives"
import type {
    AccountDataTypeDef,
    AccountExpiry,
    AccountValue,
    OptionalScopedDeliveryId,
} from "./account-data.contracts"

/** The length of a uuid in text. */
const UUID_LENGTH = 36

/** A uuid in text. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when the text is a connection id (a uuid): any other text names no account. */
export const isConnectionId = (text: string): boolean => UUID.test(text)

/** The longest key a row holds; a longer one is stored as its hash. */
export const KEY_MAX = 400

/** A key as a row holds it: itself, or `sha256:<hex>` when it is longer than a row allows (a stored key maps to itself). */
export const accountExternalIdOf = (key: string): string =>
    key.length <= KEY_MAX ? key : `sha256:${createHash("sha256").update(key).digest("hex")}`

/** Splits a connection-scoped delivery id (`<connection uuid>:<key>`); null when it has no connection or no key. */
export const scopedDeliveryIdOf = (deliveryId: string): OptionalScopedDeliveryId => {
    const connectionId = deliveryId.slice(0, UUID_LENGTH)
    const key = deliveryId.slice(UUID_LENGTH + 1)
    if (!UUID.test(connectionId) || deliveryId.charAt(UUID_LENGTH) !== ":" || key === "") return null
    return { connectionId, externalId: accountExternalIdOf(key) }
}

/** Postgres cuts identifiers at 63 bytes; a generated name is cut the same way so it is found again in the catalog. */
export const IDENT_MAX = 63

/** Cuts a generated identifier at the 63 bytes postgres keeps. */
export const identOf = (text: string): string => text.slice(0, IDENT_MAX)

/** Snake case of a name, as the entity engine spells it: `chatId` is `chat_id`, `telegram.update` is `telegram_update`. */
export const snakeOf = (text: string): string =>
    text
        .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replaceAll(/[^a-zA-Z0-9]+/g, "_")
        .toLowerCase()

/** The partition of a type: `account_data_` and the name with dots and dashes as underscores (`telegram.update` is `account_data_telegram_update`). */
export const accountPartitionOf = (type: string): string => identOf(`account_data_${type.replaceAll(/[.-]/g, "_")}`)

/** The CHECK of one member of a type's partition: `<partition>_<snake(member)>_chk`. */
export const accountCheckNameOf = (type: string, field: string): string =>
    identOf(`${accountPartitionOf(type)}_${snakeOf(field)}_chk`)

/** One declared index of a type's partition: `<partition>_<name>`. */
export const accountIndexNameOf = (type: string, name: string): string => identOf(`${accountPartitionOf(type)}_${name}`)

/** Orders two names by code unit: negative, zero or positive. */
export const byName = (left: string, right: string): number => {
    if (left < right) return -1
    return left > right ? 1 : 0
}

/** The most rows one read answers. */
export const READ_MAX = 200

/** The most batches one sweep runs per type; the next pass continues. */
export const MAX_SWEEP_BATCHES = 50

/** The rows one sweep batch deletes when the tick payload names none. */
export const DEFAULT_SWEEP_BATCH = 1000

/** A whole number within bounds read from a payload member, or the default. */
const boundedOf = (value: unknown, fallback: number, min: number, max: number): number =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback

/** The rows per batch a tick payload carries (`{ batch }`, 1 to 5000); a missing or out-of-range member takes the default. */
export const sweepBatchOf = (payload: unknown): number =>
    boundedOf(isRecord(payload) ? payload.batch : undefined, DEFAULT_SWEEP_BATCH, 1, 5000)

/** A read limit within 1 and 200. */
export const readLimitOf = (limit: number): number => Math.max(1, Math.min(Math.trunc(limit), READ_MAX))

/** The stored value of a row as its members. */
export const valueOf = (stored: object): AccountValue => Object.fromEntries(Object.entries(stored))

/** The id of the one row an `INSERT … RETURNING id` answered, or null when it answered none (the row was there). */
export const insertedIdOf = (raw: unknown): string | null => {
    if (!Array.isArray(raw)) return null
    const rows: ReadonlyArray<unknown> = raw
    const first = rows[0]
    return isRecord(first) && typeof first.id === "string" ? first.id : null
}

/** The seconds of one day. */
const DAY_SECONDS = 86_400

/** The expiry rules of one declaration: its retention days (a `wakes` type: completed rows only), and its ttl; none for a type kept for good without a ttl. */
export const expiriesOf = (def: AccountDataTypeDef): ReadonlyArray<AccountExpiry> => [
    ...(def.retention === "keep"
        ? []
        : [{ type: def.name, seconds: def.retention.days * DAY_SECONDS, processedOnly: def.wakes === true }]),
    ...(def.ttlMs === undefined ? [] : [{ type: def.name, seconds: def.ttlMs / 1000, processedOnly: false }]),
]

/** True for a JSON value (null, boolean, finite number, text, array or plain object of JSON values). */
export const isJsonValue = (value: unknown): boolean => {
    if (value === null || typeof value === "boolean" || typeof value === "string") return true
    if (typeof value === "number") return Number.isFinite(value)
    if (Array.isArray(value)) {
        const items: ReadonlyArray<unknown> = value
        return items.every((item) => isJsonValue(item))
    }
    return isRecord(value) && Object.values(value).every((member) => isJsonValue(member))
}
