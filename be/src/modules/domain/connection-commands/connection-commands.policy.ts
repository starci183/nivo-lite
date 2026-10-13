import type { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionGrantsService } from "@modules/domain/connection-grants"
import type { ConnectionLifecycleService } from "@modules/domain/connection-lifecycle"
import type { GoogleConnectionsService } from "@modules/domain/google-connections"
import type { MetaConnectionsService } from "@modules/domain/meta-connections"
import type { WebhookConnectionsService } from "@modules/domain/webhook-connections"

/** The capabilities a command can reach. */
export interface CommandServices {
    readonly connections: ConnectionsService
    readonly grants: ConnectionGrantsService
    readonly channels: ChannelConnectionsService
    readonly webhooks: WebhookConnectionsService
    readonly google: GoogleConnectionsService
    readonly meta: MetaConnectionsService
    readonly lifecycle: ConnectionLifecycleService
}

/** The untrusted fields of a command. */
type Input = Readonly<Record<string, unknown>>

/** One kind of command: reads its fields (refusing what does not fit) and calls one capability as the actor. */
type Runner = (services: CommandServices, actor: ConnectionActor, input: Input) => Promise<unknown>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const CONNECTOR_ID = /^[a-z0-9_]{1,60}$/u
const MAX_WISHES = 200
const MAX_EVENTS = 20
const LEVELS = ["read", "ask", "auto"] as const
type Level = (typeof LEVELS)[number]

const invalid = (field: string): never => {
    throw new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const uuidOf = (value: unknown, field: string): string =>
    typeof value === "string" && UUID.test(value) ? value : invalid(field)

const textOf = (value: unknown, field: string, max: number): string =>
    typeof value === "string" && value.length <= max ? value : invalid(field)

const levelOf = (value: unknown, field: string): Level => LEVELS.find((level) => level === value) ?? invalid(field)

const idField = (input: Input, field: string): string => uuidOf(input[field], field)
const connectionOf = (input: Input): string => idField(input, "connectionId")

/** One wish of a list: the id of the other side and the level when the caller picked one. */
interface Wish {
    readonly id: string
    readonly access?: Level
}

/** A list of wishes: each entry is a bare id or an object with the id and an optional level. */
const wishesOf = (input: Input, listKey: string, idKey: string): ReadonlyArray<Wish> => {
    const list = input[listKey]
    if (!Array.isArray(list) || list.length > MAX_WISHES) return invalid(listKey)
    return list.map((entry: unknown): Wish => {
        if (typeof entry === "string") return { id: uuidOf(entry, listKey) }
        if (!isRecord(entry)) return invalid(listKey)
        const id = uuidOf(entry[idKey], listKey)
        return entry.access === undefined ? { id } : { id, access: levelOf(entry.access, listKey) }
    })
}

const withAccess = (wish: Wish): { readonly access?: Level } => (wish.access === undefined ? {} : { access: wish.access })

const eventsOf = (input: Input): ReadonlyArray<string> => {
    const events = input.events
    if (!Array.isArray(events) || events.length > MAX_EVENTS) return invalid("events")
    return events.map((event: unknown) => textOf(event, "events", 40))
}

const valuesOf = (input: Input): Readonly<Record<string, string>> => {
    const values = input.values
    if (!isRecord(values)) return invalid("values")
    return Object.fromEntries(
        Object.entries(values).map(([key, value]) => [textOf(key, "values", 60), textOf(value, "values", 400)]),
    )
}

const connectorOf = (input: Input): string => {
    const connectorId = textOf(input.connectorId, "connectorId", 60)
    return CONNECTOR_ID.test(connectorId) ? connectorId : invalid("connectorId")
}

/** Every kind of command a member can submit, with the capability call it makes. */
export const COMMANDS: Readonly<Record<string, Runner>> = {
    "connection.first-event": (s, a, i) => s.connections.firstEvent(a, connectionOf(i)),
    "connection.want": (s, a, i) => s.connections.wantConnector(a, connectorOf(i)),
    "connection.check": (s, a, i) => s.channels.check(a, connectionOf(i)),
    "connection.disconnect": (s, a, i) => s.lifecycle.disconnect(a, connectionOf(i)),
    "connection.delete": (s, a, i) => s.lifecycle.remove(a, connectionOf(i)),
    "grant.set": (s, a, i) =>
        s.grants.setGrant(a, connectionOf(i), idField(i, "agentId"), i.access === null ? null : levelOf(i.access, "access")),
    "grant.connection-agents": (s, a, i) =>
        s.grants.setConnectionAgents(
            a,
            connectionOf(i),
            wishesOf(i, "agents", "agentId").map((wish) => ({ agentId: wish.id, ...withAccess(wish) })),
        ),
    "grant.agent-connections": (s, a, i) =>
        s.grants.setAgentConnections(
            a,
            idField(i, "agentId"),
            wishesOf(i, "connections", "connectionId").map((wish) => ({ connectionId: wish.id, ...withAccess(wish) })),
        ),
    "telegram.connect": (s, a, i) =>
        s.channels.connectTelegram(a, { name: textOf(i.name, "name", 120), token: textOf(i.token, "token", 200) }),
    "money.start": (s, a, i) =>
        s.channels.startMoneyConnection(a, {
            provider: textOf(i.provider, "provider", 20),
            environment: textOf(i.environment, "environment", 10),
            name: textOf(i.name, "name", 120),
            bankCode: textOf(i.bankCode, "bankCode", 40),
            accountNumber: textOf(i.accountNumber, "accountNumber", 60),
            holder: textOf(i.holder, "holder", 160),
        }),
    "money.update": (s, a, i) =>
        s.channels.updateMoneyConnection(a, connectionOf(i), {
            environment: textOf(i.environment, "environment", 10),
            name: textOf(i.name, "name", 120),
            bankCode: textOf(i.bankCode, "bankCode", 40),
            accountNumber: textOf(i.accountNumber, "accountNumber", 60),
            holder: textOf(i.holder, "holder", 160),
            ...(i.apiKey === undefined ? {} : { apiKey: textOf(i.apiKey, "apiKey", 200) }),
        }),
    "money.resume": (s, a, i) => s.channels.resumeConnection(a, connectionOf(i)),
    "money.reveal-key": (s, a, i) => s.channels.revealSepayKey(a, connectionOf(i)),
    "money.provider-keys": (s, a, i) => s.channels.saveProviderKeys(a, connectionOf(i), valuesOf(i)),
    "zalo.start": (s, a, i) =>
        s.channels.startZaloConnection(a, {
            name: textOf(i.name, "name", 120),
            appId: textOf(i.appId, "appId", 100),
            appSecret: textOf(i.appSecret, "appSecret", 200),
        }),
    "zalo.resume": (s, a, i) => s.channels.resumeZalo(a, connectionOf(i)),
    "zalo.oa-secret": (s, a, i) => s.channels.saveZaloOaSecret(a, connectionOf(i), textOf(i.oaSecret, "oaSecret", 200)),
    "zalo.authorize": (s, a, i) => s.channels.zaloAuthorizeUrl(a, connectionOf(i)),
    "webhook.start": (s, a, i) =>
        s.webhooks.start(a, { name: textOf(i.name, "name", 120), url: textOf(i.url, "url", 2048), events: eventsOf(i) }),
    "webhook.reveal": (s, a, i) => s.webhooks.reveal(a, connectionOf(i)),
    "webhook.events": (s, a, i) => s.webhooks.updateEvents(a, connectionOf(i), eventsOf(i)),
    "webhook.test": (s, a, i) => s.webhooks.test(a, connectionOf(i)),
    "webhook.finish": (s, a, i) => s.webhooks.finish(a, connectionOf(i)),
    "google.authorize": (s, a, i) => s.google.authorize(a, textOf(i.returnTo, "returnTo", 200)),
    "google.state": (s, a) => s.google.state(a),
    "google.accounts": (s, a) => s.google.accounts(a),
    "meta.authorize": (s, a, i) => s.meta.authorize(a, i.connectionId === undefined ? undefined : connectionOf(i)),
    "meta.resume": (s, a, i) => s.meta.resume(a, connectionOf(i)),
    "meta.page": (s, a, i) => s.meta.choosePage(a, connectionOf(i), textOf(i.pageId, "pageId", 64)),
    "meta.check": (s, a, i) => s.meta.check(a, connectionOf(i), i.repair === true),
}

/** Runs one command as the actor; an unknown kind or a field that does not fit is refused as invalid, and a capability answering nothing answers `true`. */
export const runCommand = async (
    services: CommandServices,
    actor: ConnectionActor,
    kind: string,
    input: Input,
): Promise<unknown> => {
    const runner = Object.hasOwn(COMMANDS, kind) ? COMMANDS[kind] : undefined
    if (runner === undefined) return invalid("kind")
    const value = await runner(services, actor, input)
    return value ?? true
}
