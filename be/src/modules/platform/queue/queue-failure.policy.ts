import { DomainError } from "@modules/platform/errors"
import { QueueError, QueueErrorCode } from "./errors/queue.error"

/** Why a flow stopped: the network or a deadline (`transient`), an input no try can fix, a bug, or a setting that is missing. Only `transient` is tried again by itself. */
export type FailureClass = "transient" | "input" | "code" | "config"

const CLASSES: ReadonlyArray<FailureClass> = ["transient", "input", "code", "config"]

/** Socket and operating-system codes of a call that failed on the way and may work a moment later. */
const TRANSIENT_SYSTEM_CODES: ReadonlySet<string> = new Set([
    "ECONNRESET",
    "ECONNREFUSED",
    "ECONNABORTED",
    "ETIMEDOUT",
    "EPIPE",
    "EAI_AGAIN",
    "ENETUNREACH",
    "EHOSTUNREACH",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET",
    "40001",
    "40P01",
])

/** The words in a capability error code that say the other side was busy or away, not that the request was wrong (HTTP_TIMEOUT, QUEUE_REDIS_DEADLINE, X_UNAVAILABLE). */
const TRANSIENT_CODE = /(^|_)(TIMEOUT|NETWORK|UNAVAILABLE|DEADLINE|RATE_LIMITED|THROTTLED|BUSY|DEADLOCK)(_|$)/u

/** The status of a server that failed rather than refused: 5xx, and the two 4xx that ask for another try. */
const isRetryableStatus = (status: unknown): boolean =>
    typeof status === "number" && (status >= 500 || status === 408 || status === 429)

const fieldOf = (value: object, key: string): unknown =>
    key in value ? Object.entries(value).find(([k]) => k === key)?.[1] : undefined

/** The error and its causes, the nearest first, bounded so a cycle ends. */
const chainOf = (cause: unknown): ReadonlyArray<object> => {
    const chain: Array<object> = []
    let current = cause
    while (typeof current === "object" && current !== null && chain.length < 5) {
        chain.push(current)
        current = current instanceof Error ? current.cause : undefined
    }
    return chain
}

const isTransientLink = (link: object): boolean => {
    if (isRetryableStatus(fieldOf(link, "status")) || isRetryableStatus(fieldOf(link, "statusCode"))) return true
    const code = fieldOf(link, "code")
    if (typeof code !== "string") return false
    return TRANSIENT_SYSTEM_CODES.has(code) || (link instanceof DomainError && TRANSIENT_CODE.test(code.toUpperCase()))
}

/** The class a flow failure was thrown with (`new QueueError({ code: QueueErrorCode.FlowFailure, params: { failureClass } })`), if the link is one. */
const namedClassOf = (link: object): FailureClass | undefined => {
    if (!(link instanceof QueueError) || link.code !== QueueErrorCode.FlowFailure) return undefined
    return CLASSES.find((candidate) => candidate === link.params.failureClass)
}

/** A capability error is refused input, or a missing setting or connection when its code says so; the thrower named what was wrong with the request, not with the moment. */
const classOfDomainError = (cause: unknown): FailureClass | undefined => {
    const link = chainOf(cause).find((candidate) => candidate instanceof DomainError)
    if (link === undefined) return undefined
    const code = fieldOf(link, "code")
    return typeof code === "string" && /_(CONFIG|CONNECTION)_/u.test(code) ? "config" : "input"
}

/**
 * The class of a thrown failure. A failure that carries a class decides its own. The network, a deadline, a server that failed and a lost
 * transaction race are `transient`. A capability error is `input`, or `config` when its code contains `_CONFIG_` or `_CONNECTION_`. Anything
 * else is `code`.
 */
export const classifyFailure = (cause: unknown): FailureClass => {
    const chain = chainOf(cause)
    const named = chain.map(namedClassOf).find((candidate) => candidate !== undefined)
    if (named !== undefined) return named
    if (chain.some(isTransientLink)) return "transient"
    return classOfDomainError(cause) ?? "code"
}
