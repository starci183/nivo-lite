import { defineAccountDataType, type AccountDataTypeDef } from "@modules/domain/account-data"

/** The name of the type of a stored interface answer. */
export const INTERFACE_SNAPSHOT_TYPE = "interface.snapshot"

/** How long a stored interface answer is served before the provider is asked again, in milliseconds. */
export const INTERFACE_SNAPSHOT_TTL_MS = 60_000

/** The largest stored interface answer, in bytes of its JSON; a larger one is not stored (the next read asks the provider). */
export const INTERFACE_SNAPSHOT_MAX_BYTES = 256_000

/**
 * The latest answer a provider gave a person's named read of one account (`<provider>:<read>` with these arguments), keyed by
 * `<verb>:<argsHash>`: served for a minute so a screen does not call the provider each time, then absent. Any provider's account may
 * hold one (provider null). It is the account's record of interface reads only: an agent's tool calls are in the gateway's call log.
 */
export const interfaceSnapshot: AccountDataTypeDef = defineAccountDataType({
    name: INTERFACE_SNAPSHOT_TYPE,
    provider: null,
    version: 1,
    write: "overwrite",
    fields: {
        verb: { type: "text", required: true, maxLength: 300 },
        argsHash: { type: "text", required: true, maxLength: 64 },
        status: { type: "text", required: true, maxLength: 20 },
        durationMs: { type: "integer", required: true },
        rows: { type: "integer", required: true },
        memberId: { type: "text", required: true, maxLength: 64 },
        answer: { type: "json", required: true },
    },
    key: ["verb", "argsHash"],
    ttlMs: INTERFACE_SNAPSHOT_TTL_MS,
    maxBytes: INTERFACE_SNAPSHOT_MAX_BYTES,
    wakes: false,
    retention: "keep",
    indexes: [],
    secretFields: [],
    purpose: "interface.answer",
})

/** Every account data type of the person-read door, for the catalog. */
export const INTERFACE_DATA_TYPES: ReadonlyArray<AccountDataTypeDef> = [interfaceSnapshot]
