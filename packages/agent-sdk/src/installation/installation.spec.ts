import { SdkDefinitionError } from "../block/definition-error"
import { runNode } from "../node/host"
import { LIST, STACK } from "../spec/spec.fixture"
import { EXAMPLE_TURN } from "../tests/fixtures/node-examples"
import { scriptedNodePorts } from "../tests/fixtures/node-ports"
import { z } from "zod"
import { defineAgentMessageKind } from "../team-chat/agent-message-kinds"
import { defineProviderTemplate } from "./provider-template"
import { defineInstallation } from "./installation"
import { entityOf, jobOf, moduleOf, nodeOf, serviceFixture, webhookEventFixture } from "./installation.fixture"

const HASH = "abc123"

/** The error a call throws. */
function captured(call: () => unknown): unknown {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

describe("defineInstallation", () => {
    it("joins the lists of every part in part order and keeps the hash it is given", () => {
        const sales = moduleOf("sales")
        const crm = moduleOf("crm")
        const node = nodeOf("nivo.tool.lead.ensure")
        const installation = defineInstallation(
            [
                { modules: [sales], blocks: [STACK], jobs: [jobOf("sales.notice")] },
                { modules: [crm], blocks: [LIST], nodes: [node], entities: [entityOf("sales.lead")] },
            ],
            HASH,
        )
        expect(installation).toMatchObject({
            modules: [sales, crm],
            blocks: [STACK, LIST],
            nodes: [node],
            jobs: [jobOf("sales.notice")],
            entities: [entityOf("sales.lead")],
            registryHash: HASH,
        })
    })

    it("accepts no parts, and parts that list nothing", () => {
        const empty = {
            modules: [],
            servers: [],
            blocks: [],
            nodes: [],
            effects: [],
            tools: [],
            dataKinds: [],
            toolLabels: {},
            providers: [],
            templates: [],
            nodeModels: {},
            messages: {},
            jobs: [],
            entities: [],
            registryHash: HASH,
        }
        expect(defineInstallation([], HASH)).toMatchObject({ ...empty, plugins: [] })
        expect(defineInstallation([{}, {}], HASH)).toMatchObject(empty)
        expect(defineInstallation([{}, {}], HASH).plugins.map((plugin) => plugin.key)).toEqual(["part0", "part1"])
    })

    it("refuses a module key two parts share, naming the kind and the key", () => {
        const twice = (): unknown =>
            defineInstallation([{ modules: [moduleOf("sales")] }, { modules: [moduleOf("sales")] }], HASH)
        expect(captured(twice)).toBeInstanceOf(SdkDefinitionError)
        expect(captured(twice)).toMatchObject({ code: "INSTALLATION_ID_DUPLICATE", params: { at: "module:sales (part0, part1)" } })
    })

    it("refuses a read or an action id that is declared twice, though the module keys differ", () => {
        const sales = moduleOf("sales")
        const crm = moduleOf("crm")
        const readTwin = { ...crm, reads: sales.reads }
        const actionTwin = { ...crm, actions: sales.actions }
        expect(captured(() => defineInstallation([{ modules: [sales, readTwin] }], HASH))).toMatchObject({
            code: "INSTALLATION_ID_DUPLICATE",
            params: { at: "read:sales.people" },
        })
        expect(captured(() => defineInstallation([{ modules: [sales, actionTwin] }], HASH))).toMatchObject({
            code: "INSTALLATION_ID_DUPLICATE",
            params: { at: "action:sales.open" },
        })
    })

    it("refuses a block, node, job or entity id that two parts, or one part twice, declare", () => {
        expect(captured(() => defineInstallation([{ blocks: [STACK] }, { blocks: [STACK] }], HASH))).toMatchObject({
            code: "INSTALLATION_ID_DUPLICATE",
            params: { at: "block:test.stack (part0, part1)" },
        })
        expect(
            captured(() => defineInstallation([{ nodes: [nodeOf("nivo.tool.lead.ensure"), nodeOf("nivo.tool.lead.ensure")] }], HASH)),
        ).toMatchObject({ params: { at: "node:nivo.tool.lead.ensure" } })
        expect(
            captured(() =>
                defineInstallation([{ jobs: [jobOf("sales.notice")] }, { jobs: [jobOf("sales.notice")] }], HASH),
            ),
        ).toMatchObject({ params: { at: "job:sales.notice (part0, part1)" } })
        expect(
            captured(() => defineInstallation([{ entities: [entityOf("sales.lead"), entityOf("sales.lead")] }], HASH)),
        ).toMatchObject({ params: { at: "entity:sales.lead" } })
    })

    it("joins the provider templates every plugin declares, and refuses one (kind, id) declared twice or a malformed one", () => {
        const document = { openapi: "3.1.0", paths: {} }
        const nivoweb = defineProviderTemplate({
            kind: "crm",
            id: "nivoweb",
            label: { vi: "NIVO Web", en: "NIVO Web" },
            openapi: document,
            swaggerPath: "/openapi.json",
            auth: { type: "bearer" },
            baseUrlHint: "https://crm.example.vn/v1",
        })
        const desk = { ...nivoweb, id: "help-desk" }
        expect(defineInstallation([{ key: "web", providers: [nivoweb] }, { providers: [desk] }], HASH).providers).toEqual([nivoweb, desk])
        expect(captured(() => defineInstallation([{ key: "web", providers: [nivoweb] }, { key: "shop", providers: [nivoweb] }], HASH))).toMatchObject({
            code: "INSTALLATION_ID_DUPLICATE",
            params: { at: "provider:crm:nivoweb (web, shop)" },
        })
        for (const id of ["Crm", "c", "crm.v1", "-crm", "a".repeat(32)]) {
            expect(captured(() => defineInstallation([{ providers: [{ ...nivoweb, id }] }], HASH))).toMatchObject({
                code: "ID_MALFORMED",
                params: { at: `provider:crm:${id}` },
            })
        }
        for (const bad of [{ swaggerPath: "openapi.json" }, { auth: { type: "header", name: "x y" } }, { openapi: { swagger: "2.0" } }, { label: { vi: "", en: "x" } }]) {
            expect(captured(() => defineInstallation([{ providers: [{ ...nivoweb, ...bad } as typeof nivoweb] }], HASH))).toMatchObject({
                code: "ID_MALFORMED",
            })
        }
    })

    it("lets the same id stand in two kinds, since each kind is its own registry", () => {
        const both = (): unknown =>
            defineInstallation([{ jobs: [jobOf("sales.lead")], entities: [entityOf("sales.lead")] }], HASH)
        expect(both).not.toThrow()
    })
})

describe("defineInstallation services", () => {
    it("joins the services of every part in part order", () => {
        const chat = serviceFixture("pkg.chat.store", "chat")
        const sales = serviceFixture("pkg.sales.store", "sales")
        expect(defineInstallation([{ services: [chat] }, {}, { services: [sales] }], HASH).services).toEqual([chat, sales])
        expect(defineInstallation([], HASH).services).toEqual([])
    })

    it("refuses a service id declared twice", () => {
        expect(
            captured(() =>
                defineInstallation(
                    [{ services: [serviceFixture("pkg.chat.store", "chat")] }, { services: [serviceFixture("pkg.chat.store", "chat", "engine.other")] }],
                    HASH,
                ),
            ),
        ).toMatchObject({ code: "INSTALLATION_ID_DUPLICATE", params: { at: "service:pkg.chat.store (part0, part1)" } })
    })

    it("refuses a second service of one contract for one module, and allows one per module", () => {
        expect(
            captured(() =>
                defineInstallation(
                    [{ services: [serviceFixture("pkg.chat.one", "chat"), serviceFixture("pkg.chat.two", "chat")] }],
                    HASH,
                ),
            ),
        ).toMatchObject({ code: "INSTALLATION_ID_DUPLICATE", params: { at: "service-slot:engine.fixture-store@chat" } })
        expect(() =>
            defineInstallation(
                [{ services: [serviceFixture("pkg.chat.one", "chat"), serviceFixture("pkg.sales.one", "sales")] }],
                HASH,
            ),
        ).not.toThrow()
    })
})

describe("defineInstallation webhook events", () => {
    it("joins the webhook events of every part in part order", () => {
        const created = webhookEventFixture("lead.created", "chatbot")
        const won = webhookEventFixture("deal.won", "sales")
        expect(defineInstallation([{ webhookEvents: [created] }, {}, { webhookEvents: [won] }], HASH).webhookEvents).toEqual([created, won])
        expect(defineInstallation([], HASH).webhookEvents).toEqual([])
    })

    it("refuses an event id declared twice, inside a part or across two", () => {
        expect(
            captured(() =>
                defineInstallation(
                    [{ webhookEvents: [webhookEventFixture("deal.won", "sales")] }, { webhookEvents: [webhookEventFixture("deal.won", "chatbot")] }],
                    HASH,
                ),
            ),
        ).toMatchObject({ code: "INSTALLATION_ID_DUPLICATE", params: { at: "webhook-event:deal.won (part0, part1)" } })
        expect(
            captured(() =>
                defineInstallation(
                    [{ webhookEvents: [webhookEventFixture("deal.won", "sales"), webhookEventFixture("deal.won", "sales")] }],
                    HASH,
                ),
            ),
        ).toMatchObject({ code: "INSTALLATION_ID_DUPLICATE" })
    })
})

describe("the fixture node", () => {
    it("does nothing and answers an empty output", async () => {
        const { ports } = scriptedNodePorts()
        const request = {
            node: nodeOf("nivo.tool.lead.ensure"),
            params: {},
            input: {},
            turn: EXAMPLE_TURN,
            grant: {},
            effects: new Map(),
            tools: new Map(),
            key: "run-1:step",
        }
        await expect(runNode(request, ports)).resolves.toEqual({ output: {}, effects: [] })
    })
})

describe("defineInstallation message kinds", () => {
    const kind = (id: string) => defineAgentMessageKind({ id, payload: z.object({ text: z.string() }), actions: { approve: false, edit: "none", reject: false } })

    it("joins the message kinds of every part in part order", () => {
        const order = kind("order.summary")
        const payment = kind("payment.received")
        expect(defineInstallation([{ messageKinds: [order] }, {}, { messageKinds: [payment] }], HASH).messageKinds).toEqual([order, payment])
        expect(defineInstallation([], HASH).messageKinds).toEqual([])
    })

    it("refuses a message kind declared twice, naming both parts", () => {
        expect(
            captured(() => defineInstallation([{ messageKinds: [kind("order.summary")] }, { messageKinds: [kind("order.summary")] }], HASH)),
        ).toMatchObject({ code: "INSTALLATION_ID_DUPLICATE", params: { at: "message-kind:order.summary (part0, part1)" } })
    })

    it("refuses a package kind that declares approve or reject: a verdict belongs to the core kinds only", () => {
        const approving = defineAgentMessageKind({ id: "sales.order-verdict", payload: z.object({}), actions: { approve: true, edit: "none", reject: false } })
        const rejecting = defineAgentMessageKind({ id: "sales.order-drop", payload: z.object({}), actions: { approve: false, edit: "none", reject: true } })
        expect(captured(() => defineInstallation([{ key: "shop", messageKinds: [approving] }], HASH))).toMatchObject({
            code: "MESSAGE_KIND_VERDICT",
            params: { at: "message-kind:sales.order-verdict (shop)" },
        })
        expect(captured(() => defineInstallation([{ messageKinds: [rejecting] }], HASH))).toMatchObject({
            code: "MESSAGE_KIND_VERDICT",
            params: { at: "message-kind:sales.order-drop (part0)" },
        })
    })

    it("refuses a package kind that takes a core kind's id", () => {
        expect(captured(() => defineInstallation([{ messageKinds: [kind("approval.decision")] }], HASH))).toMatchObject({
            code: "MESSAGE_KIND_CORE_ID",
            params: { at: "message-kind:approval.decision (part0)" },
        })
    })
})
