import type { Access } from "@/modules/types"
import { apiRequest } from "../request"
import type { Outcome } from "../outcome"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const CONNECTOR_ID = /^[a-z0-9_]{1,60}$/u
const MAX_WISHES = 200
const MAX_RETURN_PATH = 200
const isLevel = (value: unknown): value is Access => value === "read" || value === "ask" || value === "auto"
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)

/** The HTTP methods the api serves. */
type CommandMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** One call to a console endpoint of the api: the workspace header, the verb, the path and an optional JSON body. */
export interface CommandRequest {
    readonly workspaceId: string
    readonly method: CommandMethod
    readonly path: string
    readonly body?: unknown
}

/** The catalog keys a write answers with when the failure happens before the api is reached (the same `connections` namespace as the api failures). */
export const FAILURE_KEYS = { refused: "errForbidden", invalid: "errGeneric" } as const

const targetRequest =
    (method: CommandMethod, suffix: string, body?: unknown) =>
    (input: unknown): CommandRequest | null => {
        if (!isRecord(input) || !isUuid(input.workspaceId) || !isUuid(input.connectionId)) return null
        const path = `/connections/${input.connectionId}${suffix}`
        return { workspaceId: input.workspaceId, method, path, ...(body === undefined ? {} : { body }) }
    }

/* request builders */
const checkRequest = targetRequest("POST", "/check")
const disconnectRequest = targetRequest("POST", "/disconnect")
const deleteRequest = targetRequest("DELETE", "")
const firstEventRequest = targetRequest("GET", "/first-event")
const sepayKeyRequest = targetRequest("GET", "/sepay-key")
const metaResumeRequest = targetRequest("GET", "/meta")
const metaPageRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId) || !isUuid(input.connectionId)) return null
    const { pageId } = input
    if (typeof pageId !== "string" || pageId === "" || pageId.length > 64) return null
    return {
        workspaceId: input.workspaceId,
        method: "POST",
        path: `/connections/${input.connectionId}/meta-page`,
        body: { pageId },
    }
}
const metaCheckRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId) || !isUuid(input.connectionId)) return null
    return {
        workspaceId: input.workspaceId,
        method: "POST",
        path: `/connections/${input.connectionId}/meta-check`,
        body: { repair: input.repair === true },
    }
}
const metaAuthorizeRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId)) return null
    return {
        workspaceId: input.workspaceId,
        method: "POST",
        path: "/connections/meta/authorize",
        body: isUuid(input.connectionId) ? { connectionId: input.connectionId } : {},
    }
}
const webhookTestRequest = targetRequest("POST", "/webhook-test")

const grantRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId) || !isUuid(input.connectionId) || !isUuid(input.agentId))
        return null
    if (input.access !== null && !isLevel(input.access)) return null
    return {
        workspaceId: input.workspaceId,
        method: "PUT",
        path: `/connections/${input.connectionId}/grants/${input.agentId}`,
        body: { access: input.access },
    }
}

/** One wanted pairing: the id of the other side and an optional level (a bare id keeps the current level). */
interface Wish {
    readonly id: string
    readonly access?: Access
}

const wishOf = (entry: unknown, idKey: string): Wish | null => {
    if (isUuid(entry)) return { id: entry }
    if (!isRecord(entry)) return null
    const id = entry[idKey]
    if (!isUuid(id) || (entry.access !== undefined && !isLevel(entry.access))) return null
    return isLevel(entry.access) ? { id, access: entry.access } : { id }
}

const wishesOf = (input: unknown, idKey: string): ReadonlyArray<Wish> | null => {
    if (!Array.isArray(input) || input.length > MAX_WISHES) return null
    const wishes = input.map((entry: unknown) => wishOf(entry, idKey))
    return wishes.every((wish): wish is Wish => wish !== null) ? wishes : null
}

const withLevel = (wish: Wish): { readonly access?: Access } =>
    wish.access === undefined ? {} : { access: wish.access }

const wishesRequest =
    (ownerKey: string, listKey: string, idKey: string, pathOf: (owner: string) => string) =>
    (input: unknown): CommandRequest | null => {
        const wishes = isRecord(input) ? wishesOf(input[listKey], idKey) : null
        if (!isRecord(input) || !isUuid(input.workspaceId) || !isUuid(input[ownerKey]) || wishes === null) return null
        const list = wishes.map((wish) => ({ [idKey]: wish.id, ...withLevel(wish) }))
        return {
            workspaceId: input.workspaceId,
            method: "PUT",
            path: pathOf(input[ownerKey]),
            body: { [listKey]: list },
        }
    }

const connectionAgentsRequest = wishesRequest(
    "connectionId",
    "agents",
    "agentId",
    (owner) => `/connections/${owner}/agents`,
)
const agentConnectionsRequest = wishesRequest(
    "agentId",
    "connections",
    "connectionId",
    (owner) => `/agents/${owner}/connections`,
)

const interestRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId)) return null
    const connectorId = input.connectorId
    if (typeof connectorId !== "string" || !CONNECTOR_ID.test(connectorId)) return null
    return { workspaceId: input.workspaceId, method: "POST", path: `/connector-interest/${connectorId}` }
}

const authorizeRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId)) return null
    const returnTo = input.returnTo
    const samePath = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
    if (!samePath || returnTo.length > MAX_RETURN_PATH) return null
    return { workspaceId: input.workspaceId, method: "POST", path: "/connections/google/authorize", body: { returnTo } }
}

const ERROR_KEYS: Readonly<Record<string, string>> = {
    CONNECTIONS_FORBIDDEN: "errForbidden",
    CONNECTIONS_NOT_FOUND: "errNone",
    CONNECTIONS_NAME_INVALID: "errName",
    CONNECTIONS_STILL_CONNECTED: "errStillConnected",
    CONNECTIONS_KEY_INVALID: "errGeneric",
    CONNECTIONS_CONNECTOR_NOT_FOUND: "errConnectorNone",
    CONNECTION_GRANTS_PAIR_REFUSED: "errAccessPair",
    CONNECTION_GRANTS_CONNECTION_DISCONNECTED: "errAccessDisconnected",
    CHANNEL_CONNECTIONS_TOKEN_REJECTED: "errToken",
    CHANNEL_CONNECTIONS_NETWORK: "errNetwork",
    CHANNEL_CONNECTIONS_ZALO_TOKEN_REFUSED: "errZaloToken",
    GOOGLE_CONNECTIONS_NOT_CONFIGURED: "errNotConfigured",
    GOOGLE_CONNECTIONS_START_FAILED: "errStart",
    META_CONNECTIONS_NOT_CONFIGURED: "errNotConfigured",
    META_CONNECTIONS_NO_PAGE: "errMetaNoPage",
    META_CONNECTIONS_PAGE_GONE: "errMetaPageGone",
    META_CONNECTIONS_PAGE_IN_USE: "errMetaPageInUse",
    META_CONNECTIONS_TOKEN_REFUSED: "errMetaToken",
    META_CONNECTIONS_PERMISSION_REFUSED: "errPermission",
    META_CONNECTIONS_RATE_LIMITED: "errRate",
    META_CONNECTIONS_NETWORK: "errNetwork",
    WEBHOOK_CONNECTIONS_NO_URL: "errWebhookNoUrl",
    WEBHOOK_CONNECTIONS_URL_REFUSED: "errWebhookUrl",
    WEBHOOK_CONNECTIONS_SIGNING_UNAVAILABLE: "errWebhookSigning",
}

/** The same message when the transport kept only the HTTP status (the code of a failure is then the status text). */
const STATUS_KEYS: Readonly<Record<string, string>> = {
    "401": "errForbidden",
    "403": "errForbidden",
    "404": "errNone",
    "409": "errStillConnected",
}

/** The catalog key (namespace `connections`) of a failure code: the be error code, else the HTTP status text, else the generic key. */
export const messageKeyOf = (code: string): string => ERROR_KEYS[code] ?? STATUS_KEYS[code] ?? "errGeneric"

/** The outcome of reading a command input: the request to send, or nothing when the input is not valid. */
type RequestParse = { readonly success: true; readonly data: CommandRequest } | { readonly success: false }

const schemaOf = (build: (input: unknown) => CommandRequest | null) => ({
    safeParse: (input: unknown): RequestParse => {
        const data = build(input)
        return data === null ? { success: false } : { success: true, data }
    },
})

/** `POST /connections/:id/check` for `{ workspaceId, connectionId }`. */
export const checkSchema = schemaOf(checkRequest)
/** `POST /connections/:id/disconnect`. */
export const disconnectSchema = schemaOf(disconnectRequest)
/** `DELETE /connections/:id`. */
export const deleteSchema = schemaOf(deleteRequest)
/** `GET /connections/:id/first-event`. */
export const firstEventSchema = schemaOf(firstEventRequest)
/** `GET /connections/:id/sepay-key`. */
export const sepayKeySchema = schemaOf(sepayKeyRequest)
/** `POST /connections/:id/meta-check`. */
export const metaCheckSchema = schemaOf(metaCheckRequest)
/** `GET /connections/:id/meta`. */
export const metaResumeSchema = schemaOf(metaResumeRequest)
/** `POST /connections/:id/meta-page` for `{ workspaceId, connectionId, pageId }`. */
export const metaPageSchema = schemaOf(metaPageRequest)
/** `POST /connections/meta/authorize` for `{ workspaceId, connectionId? }`. */
export const metaAuthorizeSchema = schemaOf(metaAuthorizeRequest)
/** `POST /connections/:id/webhook-test`. */
export const webhookTestSchema = schemaOf(webhookTestRequest)
/** `PUT /connections/:id/grants/:agentId` with the level, or null to remove the access. */
export const grantSchema = schemaOf(grantRequest)
/** `PUT /connections/:id/agents` for `{ workspaceId, connectionId, agents }`. */
export const connectionAgentsSchema = schemaOf(connectionAgentsRequest)
/** `PUT /agents/:agentId/connections` for `{ workspaceId, agentId, connections }`. */
export const agentConnectionsSchema = schemaOf(agentConnectionsRequest)
/** `POST /connector-interest/:connectorId` for `{ workspaceId, connectorId }`. */
export const interestSchema = schemaOf(interestRequest)
/** `POST /connections/google/authorize` for `{ workspaceId, returnTo }`. */
export const authorizeSchema = schemaOf(authorizeRequest)

/** A failure that happens before the api is reached, in the vocabulary of the api: a field problem keyed by the generic sentence. */
export const invalid = (code: string): Outcome<never> => ({ kind: "invalid", issues: [], fault: { code } })

/** A failure leaves the server as the catalog key of its sentence (`connections` namespace), so no client needs the error table. */
export const keyed = <T>(outcome: Outcome<T>): Outcome<T> =>
    outcome.kind === "ok"
        ? outcome
        : { ...outcome, fault: { ...outcome.fault, code: messageKeyOf(outcome.fault.code) } }

/** Sends one console command to the api with the active workspace and returns what it answered. */
export const sendCommand = async <T>(request: CommandRequest): Promise<Outcome<T>> =>
    keyed(
        await apiRequest<T>(request.path, {
            method: request.method,
            workspaceId: request.workspaceId,
            ...(request.body === undefined ? {} : { body: request.body }),
        }),
    )

/** Sends a command whose success has no body (204) and answers `true`. */
export const sendDone = async (request: CommandRequest): Promise<Outcome<true>> => {
    const result = await sendCommand<undefined>(request)
    return result.kind === "ok" ? { kind: "ok", value: true as const } : result
}
