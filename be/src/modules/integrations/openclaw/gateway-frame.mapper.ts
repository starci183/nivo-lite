import type { OpenclawAuth } from "./openclaw.options"

/**
 * OpenClaw gateway wire protocol 4 (raw WebSocket on port 18789). Frames are JSON text in three envelopes: req, res and event.
 * There are no namespaces and it is not Socket.IO. Everything here is pure: it maps text to frames and payloads to messages.
 */
export const PROTOCOL_VERSION = 4

/** `client.id` and `client.mode` are closed enums on the gateway; a device-less caller is `cli` / `cli`. */
export const CLIENT_ID = "cli"
/** The client mode of a device-less caller. */
export const CLIENT_MODE = "cli"
/** The scopes declared at connect; the gateway honours them only on a loopback connection with a shared secret. */
export const SCOPES: ReadonlyArray<string> = ["operator.read", "operator.write"]
/** The scopes of operator maintenance: deleting an agent needs operator.admin, which a turn never holds. */
export const ADMIN_SCOPES: ReadonlyArray<string> = [...SCOPES, "operator.admin"]

/** The error body of a refused request. */
export interface GatewayErrorBody {
    /** The gateway code, `UNAVAILABLE` while it starts. */
    readonly code: string
    /** The gateway message. */
    readonly message: string
    /** How long to wait before retrying, ms, when the gateway said. */
    readonly retryAfterMs: number | null
}

/** One frame the gateway sent: the answer to a request, or an event. */
export type GatewayFrame =
    | {
          readonly type: "res"
          readonly id: string
          readonly ok: boolean
          readonly payload: unknown
          readonly error: GatewayErrorBody | null
      }
    | { readonly type: "event"; readonly event: string; readonly payload: unknown }

/** A frame or nothing. */
export type OptionalGatewayFrame = GatewayFrame | null

/** What one assistant message cost: provider usage as OpenClaw normalises it, plus who served it. */
export interface MessageUsage {
    /** Input tokens. */
    readonly input: number
    /** Output tokens. */
    readonly output: number
    /** Tokens read from the cache. */
    readonly cacheRead: number
    /** Tokens written to the cache. */
    readonly cacheWrite: number
    /** The total cost. */
    readonly cost: number
    /** `provider/model`, or null. */
    readonly model: string | null
}

/** One `session.message` event narrowed to what a turn reads. */
export interface SessionMessage {
    /** The thread the message belongs to. */
    readonly threadKey: string | null
    /** The role: user, assistant, system. */
    readonly role: string | null
    /** True when the owner sent it, so it is not a reply. */
    readonly fromOwner: boolean
    /** The text, or null when the message carries none. */
    readonly text: string | null
    /** `stop` when the model finished its answer; anything else is an interim message of a tool-using run. */
    readonly stopReason: string | null
    /** The usage of the message, or null. */
    readonly usage: MessageUsage | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const numberOf = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0

const stringOf = (value: unknown): string | null => (typeof value === "string" ? value : null)

const errorOf = (value: unknown): GatewayErrorBody | null => {
    if (!isRecord(value)) return null
    const details = isRecord(value.details) ? value.details : null
    return {
        code: stringOf(value.code) ?? "UNKNOWN",
        message: stringOf(value.message) ?? "",
        retryAfterMs: details !== null && typeof details.retryAfterMs === "number" ? details.retryAfterMs : null,
    }
}

/** Reads one decoded JSON value as a frame; null when it is not a frame this client understands. */
export const frameOf = (value: unknown): OptionalGatewayFrame => {
    if (!isRecord(value)) return null
    if (value.type === "event" && typeof value.event === "string") {
        return { type: "event", event: value.event, payload: value.payload }
    }
    if (value.type === "res" && (typeof value.id === "string" || typeof value.id === "number")) {
        return {
            type: "res",
            id: String(value.id),
            ok: value.ok === true,
            payload: value.payload,
            error: errorOf(value.error),
        }
    }
    return null
}

/** The v4 connect params: exactly these fields, the credential in the first frame only. */
export const connectParams = (
    auth: OpenclawAuth,
    platform: string,
    scopes: ReadonlyArray<string> = SCOPES,
): Record<string, unknown> => ({
    minProtocol: PROTOCOL_VERSION,
    maxProtocol: PROTOCOL_VERSION,
    client: { id: CLIENT_ID, version: "1.0.0", platform, mode: CLIENT_MODE },
    auth: auth.kind === "token" ? { token: auth.token.reveal() } : { password: auth.password.reveal() },
    role: "operator",
    scopes: [...scopes],
})

const qualifiedModel = (provider: string | null, model: string | null): string | null => {
    if (model === null) return null
    return provider === null ? model : `${provider}/${model}`
}

const usageOf = (message: unknown): MessageUsage | null => {
    if (!isRecord(message) || !isRecord(message.usage)) return null
    const usage = message.usage
    const provider = stringOf(message.provider)
    const model = stringOf(message.model)
    return {
        input: numberOf(usage.input),
        output: numberOf(usage.output),
        cacheRead: numberOf(usage.cacheRead),
        cacheWrite: numberOf(usage.cacheWrite),
        cost: isRecord(usage.cost) ? numberOf(usage.cost.total) : 0,
        model: qualifiedModel(provider, model),
    }
}

const TEXT_KEYS: ReadonlyArray<string> = ["text", "content", "body"]

const textOf = (value: unknown): string | null => {
    if (typeof value === "string") return value.trim() || null
    if (Array.isArray(value)) {
        const parts = value.map(textOf).filter((part): part is string => part !== null)
        return parts.length > 0 ? parts.join("\n") : null
    }
    if (!isRecord(value)) return null
    for (const key of TEXT_KEYS) {
        const found = textOf(value[key])
        if (found !== null) return found
    }
    return null
}

/** Narrows a `session.message` payload: `{ sessionKey, senderIsOwner?, message }`, the message being a string or an object. */
export const readSessionMessage = (payload: unknown): SessionMessage => {
    if (!isRecord(payload)) {
        return { threadKey: null, role: null, fromOwner: false, text: null, stopReason: null, usage: null }
    }
    const message = payload.message
    const body = isRecord(message) ? message : null
    return {
        threadKey: stringOf(payload.sessionKey) ?? stringOf(payload.key),
        role: body === null ? null : stringOf(body.role),
        fromOwner: payload.senderIsOwner === true,
        text: textOf(message),
        stopReason: body === null ? null : stringOf(body.stopReason),
        usage: usageOf(message),
    }
}

/** True for the contract answer: a JSON object with a `reply`; anything else may be an interim message of a tool-using run. */
export const looksFinal = (text: string): boolean => {
    const start = text.indexOf("{")
    return start >= 0 && /"reply"\s*:/u.test(text.slice(start + 1))
}

/** The run status an `agent` event carries; null when there is none. */
export const statusOf = (payload: unknown): string | null =>
    isRecord(payload) && typeof payload.status === "string" ? payload.status : null
