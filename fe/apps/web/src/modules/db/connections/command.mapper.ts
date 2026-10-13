import type { Access } from "@/modules/types"
import { submitCommand } from "../connections/submit.mapper"
import type { CommandRequest } from "../connections/submit.mapper"
import type { DbOutcome } from "../outcome"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const CONNECTOR_ID = /^[a-z0-9_]{1,60}$/u
const MAX_WISHES = 200
const MAX_RETURN_PATH = 200
const isLevel = (value: unknown): value is Access => value === "read" || value === "ask" || value === "auto"
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)

/** One command for the back end: the workspace, what to run and the fields it takes (the back end proves the role). */
export type { CommandRequest }

/** The catalog keys a write answers with when the failure happens before the back end is reached (the same `connections` namespace as the back end failures). */
export const FAILURE_KEYS = { refused: "errForbidden", invalid: "errGeneric" } as const

const targetRequest =
    (kind: string) =>
    (input: unknown): CommandRequest | null => {
        if (!isRecord(input) || !isUuid(input.workspaceId) || !isUuid(input.connectionId)) return null
        return { workspaceId: input.workspaceId, kind, input: { connectionId: input.connectionId } }
    }

/* request builders */
const checkRequest = targetRequest("connection.check")
const disconnectRequest = targetRequest("connection.disconnect")
const deleteRequest = targetRequest("connection.delete")
const firstEventRequest = targetRequest("connection.first-event")
const sepayKeyRequest = targetRequest("money.reveal-key")
const metaResumeRequest = targetRequest("meta.resume")
const metaPageRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId) || !isUuid(input.connectionId)) return null
    const { pageId } = input
    if (typeof pageId !== "string" || pageId === "" || pageId.length > 64) return null
    return { workspaceId: input.workspaceId, kind: "meta.page", input: { connectionId: input.connectionId, pageId } }
}
const metaCheckRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId) || !isUuid(input.connectionId)) return null
    return {
        workspaceId: input.workspaceId,
        kind: "meta.check",
        input: { connectionId: input.connectionId, repair: input.repair === true },
    }
}
const metaAuthorizeRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId)) return null
    return {
        workspaceId: input.workspaceId,
        kind: "meta.authorize",
        input: isUuid(input.connectionId) ? { connectionId: input.connectionId } : {},
    }
}
const webhookTestRequest = targetRequest("webhook.test")

const grantRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId) || !isUuid(input.connectionId) || !isUuid(input.agentId))
        return null
    if (input.access !== null && !isLevel(input.access)) return null
    return {
        workspaceId: input.workspaceId,
        kind: "grant.set",
        input: { connectionId: input.connectionId, agentId: input.agentId, access: input.access },
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
    (kind: string, ownerKey: string, listKey: string, idKey: string) =>
    (input: unknown): CommandRequest | null => {
        const wishes = isRecord(input) ? wishesOf(input[listKey], idKey) : null
        if (!isRecord(input) || !isUuid(input.workspaceId) || !isUuid(input[ownerKey]) || wishes === null) return null
        const list = wishes.map((wish) => ({ [idKey]: wish.id, ...withLevel(wish) }))
        return { workspaceId: input.workspaceId, kind, input: { [ownerKey]: input[ownerKey], [listKey]: list } }
    }

const connectionAgentsRequest = wishesRequest("grant.connection-agents", "connectionId", "agents", "agentId")
const agentConnectionsRequest = wishesRequest("grant.agent-connections", "agentId", "connections", "connectionId")

const interestRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId)) return null
    const connectorId = input.connectorId
    if (typeof connectorId !== "string" || !CONNECTOR_ID.test(connectorId)) return null
    return { workspaceId: input.workspaceId, kind: "connection.want", input: { connectorId } }
}

const authorizeRequest = (input: unknown): CommandRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId)) return null
    const returnTo = input.returnTo
    const samePath = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
    if (!samePath || returnTo.length > MAX_RETURN_PATH) return null
    return { workspaceId: input.workspaceId, kind: "google.authorize", input: { returnTo } }
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

/** The command of connections :id check for `{ workspaceId, connectionId }`. */
export const checkSchema = schemaOf(checkRequest)
/** The command of connections :id disconnect. */
export const disconnectSchema = schemaOf(disconnectRequest)
/** The command of connections :id. */
export const deleteSchema = schemaOf(deleteRequest)
/** The command of connections :id first-event. */
export const firstEventSchema = schemaOf(firstEventRequest)
/** The command of connections :id sepay-key. */
export const sepayKeySchema = schemaOf(sepayKeyRequest)
/** The command of connections :id meta-check. */
export const metaCheckSchema = schemaOf(metaCheckRequest)
/** The command of connections :id meta. */
export const metaResumeSchema = schemaOf(metaResumeRequest)
/** The command of connections :id meta-page for `{ workspaceId, connectionId, pageId }`. */
export const metaPageSchema = schemaOf(metaPageRequest)
/** The command of connections meta authorize for `{ workspaceId, connectionId? }`. */
export const metaAuthorizeSchema = schemaOf(metaAuthorizeRequest)
/** The command of connections :id webhook-test. */
export const webhookTestSchema = schemaOf(webhookTestRequest)
/** The command of connections :id grants :agentId with the level, or null to remove the access. */
export const grantSchema = schemaOf(grantRequest)
/** The command of connections :id agents for `{ workspaceId, connectionId, agents }`. */
export const connectionAgentsSchema = schemaOf(connectionAgentsRequest)
/** The command of agents :agentId connections for `{ workspaceId, agentId, connections }`. */
export const agentConnectionsSchema = schemaOf(agentConnectionsRequest)
/** The command of connector-interest :connectorId for `{ workspaceId, connectorId }`. */
export const interestSchema = schemaOf(interestRequest)
/** The command of connections google authorize for `{ workspaceId, returnTo }`. */
export const authorizeSchema = schemaOf(authorizeRequest)

/** A failure that happens before the back end is reached: a field problem keyed by the generic sentence. */
export const invalid = (code: string): DbOutcome<never> => ({ kind: "invalid", code })

/** A failure leaves the server as the catalog key of its sentence (`connections` namespace), so no client needs the error table. */
export const keyed = <T>(outcome: DbOutcome<T>): DbOutcome<T> =>
    outcome.kind === "ok" ? outcome : { ...outcome, code: messageKeyOf(outcome.code) }

/** Sends one console command to the back end through the database with the active workspace and returns what it answered. */
export const sendCommand = async <T>(request: CommandRequest): Promise<DbOutcome<T>> =>
    keyed(await submitCommand<T>(request))

/** Sends a command whose success has no answer and answers `true`. */
export const sendDone = async (request: CommandRequest): Promise<DbOutcome<true>> => {
    const result = await sendCommand<unknown>(request)
    return result.kind === "ok" ? { kind: "ok", value: true as const } : result
}
