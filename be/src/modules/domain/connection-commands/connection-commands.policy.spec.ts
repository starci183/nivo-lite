import type * as SubjectModule from "./connection-commands.policy"
import { strict as assert } from "node:assert"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import type { ChannelConnectionsService } from "@modules/domain/channel-connections"
import type { ConnectionGrantsService } from "@modules/domain/connection-grants"
import type { ConnectionLifecycleService } from "@modules/domain/connection-lifecycle"
import { ConnectionsError } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionsService } from "@modules/domain/connections"
import type { GoogleConnectionsService } from "@modules/domain/google-connections"
import type { MetaConnectionsService } from "@modules/domain/meta-connections"
import type { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { COMMANDS, runCommand } from "./connection-commands.policy"
import type { CommandServices } from "./connection-commands.policy"

const SUBJECT = Symbol("connection-commands.policy")
type Subject = Pick<typeof SubjectModule, "runCommand">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { runCommand } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const CONNECTION = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
const AGENT = "11111111-2222-3333-4444-555555555555"
const OTHER = "66666666-7777-8888-9999-000000000000"
const actor: ConnectionActor = { principalId: "member-1", workspaceId: "workspace-1" }

type Input = Readonly<Record<string, unknown>>
type Services = { [Key in keyof CommandServices]: MockOf<CommandServices[Key]> }
interface Route {
    readonly kind: string
    readonly input: Input
    readonly args: ReadonlyArray<unknown>
    readonly call: (services: Services) => jest.Mock
}

const money = {
    environment: "test",
    name: "Bank account",
    bankCode: "VCB",
    accountNumber: "1234567890",
    holder: "Lan",
}

const byConnection = (kind: string, call: Route["call"]): Route => ({
    kind,
    input: { connectionId: CONNECTION },
    args: [actor, CONNECTION],
    call,
})

const routes: ReadonlyArray<Route> = [
    byConnection("connection.first-event", (s) => s.connections.firstEvent),
    {
        kind: "connection.want",
        input: { connectorId: "telegram_user" },
        args: [actor, "telegram_user"],
        call: (s) => s.connections.wantConnector,
    },
    byConnection("connection.check", (s) => s.channels.check),
    byConnection("connection.disconnect", (s) => s.lifecycle.disconnect),
    byConnection("connection.delete", (s) => s.lifecycle.remove),
    {
        kind: "grant.set",
        input: { connectionId: CONNECTION, agentId: AGENT, access: "read" },
        args: [actor, CONNECTION, AGENT, "read"],
        call: (s) => s.grants.setGrant,
    },
    {
        kind: "grant.connection-agents",
        input: {
            connectionId: CONNECTION,
            agents: [AGENT, { agentId: OTHER }, { agentId: AGENT, access: "auto" }],
        },
        args: [actor, CONNECTION, [{ agentId: AGENT }, { agentId: OTHER }, { agentId: AGENT, access: "auto" }]],
        call: (s) => s.grants.setConnectionAgents,
    },
    {
        kind: "grant.agent-connections",
        input: {
            agentId: AGENT,
            connections: [CONNECTION, { connectionId: OTHER }, { connectionId: CONNECTION, access: "ask" }],
        },
        args: [
            actor,
            AGENT,
            [{ connectionId: CONNECTION }, { connectionId: OTHER }, { connectionId: CONNECTION, access: "ask" }],
        ],
        call: (s) => s.grants.setAgentConnections,
    },
    {
        kind: "telegram.connect",
        input: { name: "Shop bot", token: "telegram-token" },
        args: [actor, { name: "Shop bot", token: "telegram-token" }],
        call: (s) => s.channels.connectTelegram,
    },
    {
        kind: "money.start",
        input: { provider: "sepay", ...money },
        args: [actor, { provider: "sepay", ...money }],
        call: (s) => s.channels.startMoneyConnection,
    },
    {
        kind: "money.update",
        input: { connectionId: CONNECTION, ...money, apiKey: "api-key" },
        args: [actor, CONNECTION, { ...money, apiKey: "api-key" }],
        call: (s) => s.channels.updateMoneyConnection,
    },
    byConnection("money.resume", (s) => s.channels.resumeConnection),
    byConnection("money.reveal-key", (s) => s.channels.revealSepayKey),
    {
        kind: "money.provider-keys",
        input: { connectionId: CONNECTION, values: { client_id: "client", secret: "secret" } },
        args: [actor, CONNECTION, { client_id: "client", secret: "secret" }],
        call: (s) => s.channels.saveProviderKeys,
    },
    {
        kind: "webhook.start",
        input: { name: "Orders", url: "https://hooks.example.test/orders", events: ["order.created", "order.paid"] },
        args: [
            actor,
            { name: "Orders", url: "https://hooks.example.test/orders", events: ["order.created", "order.paid"] },
        ],
        call: (s) => s.webhooks.start,
    },
    byConnection("webhook.view", (s) => s.webhooks.view),
    {
        kind: "webhook.events",
        input: { connectionId: CONNECTION, events: ["order.created", "order.paid"] },
        args: [actor, CONNECTION, ["order.created", "order.paid"]],
        call: (s) => s.webhooks.updateEvents,
    },
    byConnection("webhook.test", (s) => s.webhooks.test),
    byConnection("webhook.finish", (s) => s.webhooks.finish),
    {
        kind: "google.authorize",
        input: { returnTo: "/settings/connections" },
        args: [actor, "/settings/connections"],
        call: (s) => s.google.authorize,
    },
    { kind: "google.state", input: {}, args: [actor], call: (s) => s.google.state },
    { kind: "google.accounts", input: {}, args: [actor], call: (s) => s.google.accounts },
    byConnection("meta.authorize", (s) => s.meta.authorize),
    byConnection("meta.resume", (s) => s.meta.resume),
    {
        kind: "meta.page",
        input: { connectionId: CONNECTION, pageId: "page-123" },
        args: [actor, CONNECTION, "page-123"],
        call: (s) => s.meta.choosePage,
    },
    {
        kind: "meta.check",
        input: { connectionId: CONNECTION, repair: true },
        args: [actor, CONNECTION, true],
        call: (s) => s.meta.check,
    },
]

const build = (): Services => {
    const services: Services = {
        connections: mock<ConnectionsService>(),
        grants: mock<ConnectionGrantsService>(),
        channels: mock<ChannelConnectionsService>(),
        webhooks: mock<WebhookConnectionsService>(),
        google: mock<GoogleConnectionsService>(),
        meta: mock<MetaConnectionsService>(),
        lifecycle: mock<ConnectionLifecycleService>(),
    }
    return services
}

const routeFor = (kind: string): Route => {
    const route = routes.find((candidate) => candidate.kind === kind)
    assert.ok(route, `Missing test route for ${kind}`)
    return route
}

const refuses = async (kind: string, input: Input, field: string): Promise<void> => {
    const subject = await buildSubject()

    const services = build()
    const cause: unknown = await subject.runCommand(services, actor, kind, input).catch((error: unknown) => error)
    expect(cause).toBeInstanceOf(ConnectionsError)
    expect(cause).toHaveProperty("code", "CONNECTIONS_COMMAND_INVALID")
    expect(cause).toHaveProperty("params", { field })
    for (const route of routes) expect(route.call(services)).not.toHaveBeenCalled()
}

const textFields: ReadonlyArray<readonly [string, string, number]> = [
    ["telegram.connect", "name", 120],
    ["telegram.connect", "token", 200],
    ["money.start", "provider", 20],
    ["money.start", "environment", 10],
    ["money.start", "name", 120],
    ["money.start", "bankCode", 40],
    ["money.start", "accountNumber", 60],
    ["money.start", "holder", 160],
    ["money.update", "environment", 10],
    ["money.update", "name", 120],
    ["money.update", "bankCode", 40],
    ["money.update", "accountNumber", 60],
    ["money.update", "holder", 160],
    ["money.update", "apiKey", 200],
    ["webhook.start", "name", 120],
    ["webhook.start", "url", 2048],
    ["google.authorize", "returnTo", 200],
    ["meta.page", "pageId", 64],
]

describe("connection commands policy", () => {
    it("lists exactly the supported kinds", () => {
        expect(Object.keys(COMMANDS)).toEqual(routes.map((route) => route.kind))
    })

    it.each(routes)("runs $kind with the actor and its exact capability arguments", async (route) => {
        const subject = await buildSubject()

        const services = build()
        const call = route.call(services)
        const answer = { accepted: route.kind }
        call.mockResolvedValue(answer)

        await expect(subject.runCommand(services, actor, route.kind, route.input)).resolves.toEqual(answer)

        expect(call.mock.calls).toEqual([route.args])
        for (const other of routes) {
            if (other.kind !== route.kind) expect(other.call(services)).not.toHaveBeenCalled()
        }
    })

    it.each([
        "unknown.command",
        "zalo.start",
        "zalo.resume",
        "zalo.oa-secret",
        "zalo.authorize",
        "",
        "toString",
        "constructor",
        "hasOwnProperty",
        "__proto__",
    ])("refuses the unknown or inherited kind %s", (kind) => refuses(kind, {}, "kind"))

    it.each([undefined, null])("turns a capability's %p answer into true", async (answer) => {
        const subject = await buildSubject()

        const services = build()
        routeFor("connection.delete").call(services).mockResolvedValue(answer)
        await expect(
            subject.runCommand(services, actor, "connection.delete", { connectionId: CONNECTION }),
        ).resolves.toBe(true)
        expect(services.lifecycle.remove).toHaveBeenCalledWith(actor, CONNECTION)
    })

    it.each([false, 0, ""])("keeps the non-nullish answer %p", async (answer) => {
        const subject = await buildSubject()

        const services = build()
        routeFor("google.state").call(services).mockResolvedValue(answer)
        await expect(subject.runCommand(services, actor, "google.state", {})).resolves.toBe(answer)
    })

    it("propagates a capability failure unchanged", async () => {
        const subject = await buildSubject()

        const services = build()
        const cause = new Error("capability failed")
        services.google.accounts.mockRejectedValue(cause)
        await expect(subject.runCommand(services, actor, "google.accounts", {})).rejects.toBe(cause)
    })
})

describe("connection commands policy", () => {
    describe("UUID fields", () => {
        const fields = routes.flatMap((route) =>
            ["connectionId", "agentId"]
                .filter((field) => Object.hasOwn(route.input, field))
                .map((field) => ({ kind: route.kind, input: route.input, field })),
        )

        it.each(fields)("refuses a non-UUID $field for $kind", async ({ kind, input, field }) => {
            if (kind !== "meta.authorize") await refuses(kind, { ...input, [field]: undefined }, field)
            await refuses(kind, { ...input, [field]: "not-a-uuid" }, field)
            await refuses(kind, { ...input, [field]: 123 }, field)
            await refuses(kind, { ...input, [field]: null }, field)
        })

        it("accepts uppercase hex UUIDs without changing them", async () => {
            const subject = await buildSubject()

            const services = build()
            const id = CONNECTION.toUpperCase()
            await subject.runCommand(services, actor, "connection.first-event", { connectionId: id })
            expect(services.connections.firstEvent).toHaveBeenCalledWith(actor, id)
        })
    })

    describe("text fields", () => {
        it.each(textFields)("validates %s.%s through its %i-character limit", async (kind, field, max) => {
            const subject = await buildSubject()

            const route = routeFor(kind)
            if (field !== "apiKey") await refuses(kind, { ...route.input, [field]: undefined }, field)
            await refuses(kind, { ...route.input, [field]: null }, field)
            await refuses(kind, { ...route.input, [field]: 42 }, field)
            await refuses(kind, { ...route.input, [field]: "x".repeat(max + 1) }, field)
            const services = build()
            const text = "x".repeat(max)

            await subject.runCommand(services, actor, kind, { ...route.input, [field]: text })

            const call = route.call(services)
            const expected = route.args.map((argument) =>
                typeof argument === "object" && argument !== null && Object.hasOwn(argument, field)
                    ? { ...argument, [field]: text }
                    : argument,
            )
            const directField = ["oaSecret", "returnTo", "pageId"].includes(field)
            expect(call).toHaveBeenCalledWith(...(directField ? [...expected.slice(0, -1), text] : expected))
        })

        it("passes empty text through for the capability to validate", async () => {
            const subject = await buildSubject()

            const services = build()
            await subject.runCommand(services, actor, "telegram.connect", { name: "", token: "" })
            expect(services.channels.connectTelegram).toHaveBeenCalledWith(actor, { name: "", token: "" })
        })
    })

    describe("connector ids", () => {
        it.each([undefined, null, 1, {}, [], "", "Telegram", "with-dash", "with space", "a".repeat(61)])(
            "refuses %p",
            (connectorId) => refuses("connection.want", { connectorId }, "connectorId"),
        )

        it.each(["a", "0_", "a".repeat(60)])("accepts the allowed id %s unchanged", async (connectorId) => {
            const subject = await buildSubject()

            const services = build()

            await subject.runCommand(services, actor, "connection.want", { connectorId })

            expect(services.connections.wantConnector).toHaveBeenCalledWith(actor, connectorId)
        })
    })
})

describe("connection commands policy access and optional fields", () => {
    it.each(["read", "ask", "auto", null])("passes the grant level %p unchanged", async (access) => {
        const subject = await buildSubject()

        const services = build()

        await subject.runCommand(services, actor, "grant.set", { connectionId: CONNECTION, agentId: AGENT, access })

        expect(services.grants.setGrant).toHaveBeenCalledWith(actor, CONNECTION, AGENT, access)
    })

    it.each([undefined, "owner", "READ", 1, {}, []])("refuses the grant level %p", async (access) => {
        await refuses("grant.set", { connectionId: CONNECTION, agentId: AGENT, access }, "access")
    })

    it("omits an absent apiKey from a money update", async () => {
        const subject = await buildSubject()

        const services = build()

        await subject.runCommand(services, actor, "money.update", { connectionId: CONNECTION, ...money })

        expect(services.channels.updateMoneyConnection).toHaveBeenCalledWith(actor, CONNECTION, money)
    })

    it("authorizes Meta with an absent connectionId", async () => {
        const subject = await buildSubject()

        const services = build()

        await subject.runCommand(services, actor, "meta.authorize", {})

        expect(services.meta.authorize).toHaveBeenCalledWith(actor, undefined)
    })

    it.each([undefined, null, false, "true", 1])(
        "only enables Meta repair for literal true, not %p",
        async (repair) => {
            const subject = await buildSubject()

            const services = build()
            await subject.runCommand(services, actor, "meta.check", { connectionId: CONNECTION, repair })
            expect(services.meta.check).toHaveBeenCalledWith(actor, CONNECTION, false)
        },
    )
})

describe("connection commands policy", () => {
    describe.each([
        { kind: "grant.connection-agents", listKey: "agents", idKey: "agentId", id: AGENT },
        { kind: "grant.agent-connections", listKey: "connections", idKey: "connectionId", id: CONNECTION },
    ])("$kind wishes", ({ kind, listKey, idKey, id }) => {
        const base = routeFor(kind).input
        it.each([undefined, null, {}, "ids", 1, Array.from({ length: 201 }, () => id)])(
            "refuses a list that does not fit: %p",
            (list) => refuses(kind, { ...base, [listKey]: list }, listKey),
        )
        it.each([null, 1, false, [], "bad-id", {}, { access: "read" }])(
            "refuses an entry that does not fit: %p",
            (entry) => refuses(kind, { ...base, [listKey]: [entry] }, listKey),
        )
        it.each([null, 1, "bad-id"])("refuses a bad id in an object: %p", async (badId) => {
            await refuses(kind, { ...base, [listKey]: [{ [idKey]: badId }] }, listKey)
        })
        it.each([null, "owner", 1, {}, []])("refuses a bad optional level: %p", async (access) => {
            await refuses(kind, { ...base, [listKey]: [{ [idKey]: id, access }] }, listKey)
        })
        it.each([0, 200])("accepts %i wishes and maps bare ids exactly", async (length) => {
            const subject = await buildSubject()
            const services = build()
            const list = Array.from({ length }, () => id)
            await subject.runCommand(services, actor, kind, { ...base, [listKey]: list })
            const parentId = listKey === "agents" ? CONNECTION : AGENT
            expect(routeFor(kind).call(services)).toHaveBeenCalledWith(
                actor,
                parentId,
                list.map(() => ({ [idKey]: id })),
            )
        })
        it("keeps all optional levels and leaves undefined access absent", async () => {
            const subject = await buildSubject()
            const services = build()
            const list = [
                { [idKey]: id, access: undefined },
                { [idKey]: id, access: "read" },
                { [idKey]: id, access: "ask" },
                { [idKey]: id, access: "auto" },
            ]
            await subject.runCommand(services, actor, kind, { ...base, [listKey]: list })
            expect(routeFor(kind).call(services)).toHaveBeenCalledWith(
                actor,
                listKey === "agents" ? CONNECTION : AGENT,
                [
                    { [idKey]: id },
                    { [idKey]: id, access: "read" },
                    { [idKey]: id, access: "ask" },
                    { [idKey]: id, access: "auto" },
                ],
            )
        })
    })
})

describe("connection commands policy", () => {
    describe.each(["webhook.start", "webhook.events"])("%s events", (kind) => {
        const base = routeFor(kind).input
        it.each([undefined, null, {}, "event", 1, Array.from({ length: 21 }, () => "event")])(
            "refuses a list that does not fit: %p",
            (events) => refuses(kind, { ...base, events }, "events"),
        )
        it.each([null, 1, {}, [], "x".repeat(41)])("refuses an event that does not fit: %p", async (event) => {
            await refuses(kind, { ...base, events: [event] }, "events")
        })
        it.each([{ events: [] }, { events: Array.from({ length: 20 }, () => "x".repeat(40)) }])(
            "accepts boundary events $events",
            async ({ events }) => {
                const subject = await buildSubject()
                const services = build()
                await subject.runCommand(services, actor, kind, { ...base, events })
                if (kind === "webhook.start") {
                    expect(services.webhooks.start).toHaveBeenCalledWith(actor, {
                        name: "Orders",
                        url: "https://hooks.example.test/orders",
                        events,
                    })
                } else {
                    expect(services.webhooks.updateEvents).toHaveBeenCalledWith(actor, CONNECTION, events)
                }
            },
        )
    })
    describe("provider values", () => {
        it.each([undefined, null, "value", 1, [], { ["x".repeat(61)]: "v" }, { key: "x".repeat(401) }, { key: 1 }])(
            "refuses values that do not fit: %p",
            (values) => refuses("money.provider-keys", { connectionId: CONNECTION, values }, "values"),
        )
        it.each([{}, { ["x".repeat(60)]: "y".repeat(400), "": "" }])(
            "accepts an empty map or the exact key and value limits",
            async (values) => {
                const subject = await buildSubject()
                const services = build()
                await subject.runCommand(services, actor, "money.provider-keys", { connectionId: CONNECTION, values })
                expect(services.channels.saveProviderKeys).toHaveBeenCalledWith(actor, CONNECTION, values)
            },
        )
    })
})
