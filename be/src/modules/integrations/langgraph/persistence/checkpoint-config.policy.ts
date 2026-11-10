import { LanggraphError, LanggraphErrorCode } from "../errors/langgraph.error"
import { THREAD_CONFIG } from "../langgraph.port"

/** The longest thread id, checkpoint id, task id or channel a row stores; the tables check the same bound. */
export const CHECKPOINT_KEY_MAX = 200

/** The longest checkpoint namespace or task path a row stores. */
export const CHECKPOINT_PATH_MAX = 2000

/** The library's own keys of `config.configurable`, beside the client's `THREAD_CONFIG`. */
const LIBRARY_CONFIG = { namespace: "checkpoint_ns", checkpoint: "checkpoint_id" } as const

/** What a saver call is addressed to, read from `config.configurable`; null where the caller named nothing. */
export interface CheckpointAddress {
    /** The workspace the thread belongs to, or null. */
    readonly workspaceId: string | null
    /** The thread, or null. */
    readonly threadId: string | null
    /** The checkpoint namespace, or null when the caller named none. */
    readonly namespace: string | null
    /** The checkpoint id, or null. */
    readonly checkpointId: string | null
    /** The fence of the caller's lease, or null when it drives under none. */
    readonly fence: number | null
}

/** Refuses a key by name; the value itself is never put in the error. */
const refuse = (key: string): never => {
    throw new LanggraphError({ code: LanggraphErrorCode.CheckpointKeyInvalid, params: { key } })
}

/**
 * Reads a key a row stores: a string of 1 to `CHECKPOINT_KEY_MAX` characters.
 *
 * @param value - The value given.
 * @param key - The name of the key, for the refusal.
 * @returns The string.
 * @throws {LanggraphError} `LANGGRAPH_CHECKPOINT_KEY_INVALID` when it is anything else.
 */
export const keyOf = (value: unknown, key: string): string =>
    typeof value === "string" && value.length >= 1 && value.length <= CHECKPOINT_KEY_MAX ? value : refuse(key)

/**
 * Reads a namespace or a task path: a string of at most `CHECKPOINT_PATH_MAX` characters, which may be empty.
 *
 * @param value - The value given.
 * @param key - The name of the key, for the refusal.
 * @returns The string.
 * @throws {LanggraphError} `LANGGRAPH_CHECKPOINT_KEY_INVALID` when it is anything else.
 */
export const pathOf = (value: unknown, key: string): string =>
    typeof value === "string" && value.length <= CHECKPOINT_PATH_MAX ? value : refuse(key)

/** A key the caller may leave out: undefined, null and the empty string all read as "not named". */
const optionalKeyOf = (value: unknown, key: string): string | null =>
    value === undefined || value === null || value === "" ? null : keyOf(value, key)

/** The fence: a whole number that is not negative, or null when the caller named none. */
const fenceOf = (value: unknown): number | null => {
    if (value === undefined || value === null) return null
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : refuse(THREAD_CONFIG.fence)
}

/**
 * Reads what a saver call is addressed to. The workspace and the fence come from here and never from a state value, so a node
 * cannot write another workspace's thread or pass for a newer driver.
 *
 * @param configurable - `config.configurable` of the call, or undefined.
 * @returns The address; each part null when the caller did not name it.
 * @throws {LanggraphError} `LANGGRAPH_CHECKPOINT_KEY_INVALID` when a part is named with a value a row cannot store.
 */
export const addressOf = (configurable: Readonly<Record<string, unknown>> | undefined): CheckpointAddress => {
    const given = configurable ?? {}
    const namespace = given[LIBRARY_CONFIG.namespace]
    return {
        workspaceId: optionalKeyOf(given[THREAD_CONFIG.workspace], THREAD_CONFIG.workspace),
        threadId: optionalKeyOf(given[THREAD_CONFIG.thread], THREAD_CONFIG.thread),
        namespace: namespace === undefined || namespace === null ? null : pathOf(namespace, LIBRARY_CONFIG.namespace),
        checkpointId: optionalKeyOf(given[LIBRARY_CONFIG.checkpoint], LIBRARY_CONFIG.checkpoint),
        fence: fenceOf(given[THREAD_CONFIG.fence]),
    }
}

/**
 * The part of an address a call cannot go without.
 *
 * @param value - The part read by `addressOf`.
 * @param key - The name of the key, for the refusal.
 * @returns The value.
 * @throws {LanggraphError} `LANGGRAPH_CHECKPOINT_SCOPE_MISSING` when the caller did not name it.
 */
export const required = (value: string | null, key: string): string => {
    if (value === null) throw new LanggraphError({ code: LanggraphErrorCode.CheckpointScopeMissing, params: { key } })
    return value
}

/** The NUL character. */
const NUL = String.fromCodePoint(0)

/** True for a value JSON leaves out of an object: nothing, a function, a symbol. */
const isDropped = (value: unknown): boolean =>
    value === undefined || typeof value === "function" || typeof value === "symbol"

/**
 * The value as JSON carries it, with the NUL character dropped from every string and key: a `jsonb` column cannot hold it. What
 * JSON leaves out of an object is left out; what it writes as null in a list (or for a number that is not finite) is null.
 */
const jsonOf = (value: unknown): unknown => {
    if (typeof value === "string") return value.replaceAll(NUL, "")
    if (typeof value === "boolean" || value === null) return value
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map((item) => jsonOf(item) ?? null)
    if (typeof value !== "object") return undefined
    const kept = Object.entries(value).filter(([, item]) => !isDropped(item))
    return Object.fromEntries(kept.map(([key, item]) => [key.replaceAll(NUL, ""), jsonOf(item) ?? null]))
}

/**
 * Makes a metadata value or a list filter the plain JSON object a `jsonb` column stores.
 *
 * @param value - The metadata the library handed over, or a filter.
 * @returns The plain object; empty when the value is not an object.
 */
export const plainRecordOf = (value: unknown): Readonly<Record<string, unknown>> => {
    const plain = jsonOf(value)
    return typeof plain === "object" && plain !== null && !Array.isArray(plain) ? { ...plain } : {}
}
