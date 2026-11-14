import { API } from "@nivo-lite/agent-sdk/names"
import { Test } from "@nestjs/testing"
import { pinOf, type OpenApiToolDeclaration } from "@modules/domain/openapi-tools"
import { triggersOf } from "@modules/domain/provider-triggers"
import {
    infoReadOf,
    interfaceReadOf,
    membersOf,
    offeredToolOf,
    offeredTriggersOf,
    swaggerPinOf,
    swaggerReadsOf,
    type ToolSource,
} from "./provider-offer.policy"

const SUBJECT = Symbol("provider-offer.policy")

/** The policy as Nest provides it. */
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { infoReadOf, interfaceReadOf, membersOf, offeredToolOf, offeredTriggersOf, swaggerPinOf, swaggerReadsOf },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./provider-offer.policy")>(SUBJECT)
}

/** The CRM id of the fixture (any id: a shop's own CRM, the real ones are the installed declarations) and its provider key. */
const CRM_ID = "records-api"
const CONNECTOR = `crm.${CRM_ID}`

/** A tool of the fixture source, by its name inside the connector. */
const toolOf = (name: string): string => `nivo.api.${CONNECTOR}.${name}`

const WORKSPACE_HEADER = { name: "X-Workspace-Id", in: "header", required: true, schema: { type: "string" } }

/** A small pinned CRM: one record read, one page read, one money write; no summary or description is kept by the provider. */
const CRM_DOCUMENT = {
    openapi: "3.0.3",
    info: { title: "CRM", version: "1.0.0" },
    components: { securitySchemes: { key: { type: "apiKey", in: "header", name: "X-Api-Key" } } },
    paths: {
        "/customers/{code}": {
            get: {
                operationId: "customer.get",
                parameters: [WORKSPACE_HEADER, { name: "code", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                    "200": {
                        description: "ok",
                        content: {
                            "application/json": {
                                schema: { type: "object", properties: { code: { type: "string" }, name: { type: "string" } } },
                            },
                        },
                    },
                },
            },
        },
        "/customers": {
            get: {
                operationId: "customer.find",
                parameters: [WORKSPACE_HEADER, { name: "q", in: "query", required: true, schema: { type: "string" } }],
                responses: {
                    "200": {
                        description: "ok",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        items: { type: "array", items: { type: "object", properties: { code: { type: "string" } } } },
                                        nextCursor: { type: ["string", "null"] },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/renewals": {
            post: {
                operationId: "renewal.create",
                "x-nivo-effect": "money",
                parameters: [WORKSPACE_HEADER],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { type: "object", required: ["code"], properties: { code: { type: "string" } } },
                        },
                    },
                },
                responses: { "201": { description: "made" } },
            },
        },
    },
}

/** A plugin declaration of one tool of the fixture source, by its name inside the connector. */
const declared = (name: string, reads: boolean): OpenApiToolDeclaration => ({
    tool: toolOf(name),
    connector: CONNECTOR,
    name,
    reads,
})

const CRM_DECLARATIONS: ReadonlyArray<OpenApiToolDeclaration> = [
    declared("get.customers.code", true),
    declared("get.customers", true),
    declared("post.renewals", false),
    declared("get.gone", true),
]

/** The facts a pin stores on the connection, as the pin policy writes them. */
const pinnedMeta = (): Readonly<Record<string, string>> => {
    const pinning = pinOf(
        {
            documentText: JSON.stringify(CRM_DOCUMENT),
            connector: CONNECTOR,
            swaggerUrl: "",
            workspaceHeader: "X-Workspace-Id",
            live: false,
            pinnedBy: "member-1",
            pinnedAt: "2026-11-12T00:00:00.000Z",
        },
        CRM_DECLARATIONS,
    )
    return pinning.ok ? pinning.meta : {}
}

/** A tool source declaring nothing but its id. */
const bare = (overrides: Partial<ToolSource> = {}): ToolSource => ({
    id: "nivo.tool.bank.transaction.list",
    abilityScope: "read",
    specScope: null,
    description: null,
    inputSchema: null,
    argsSchema: null,
    resultSchema: null,
    mutates: null,
    title: null,
    summary: null,
    pinned: null,
    declaredEffect: null,
    ...overrides,
})

describe("membersOf", () => {
    it("lists the properties of an object schema in order, with type, format, choices, required and the schema's own description", async () => {
        const policy = await build()
        const schema = {
            type: "object",
            required: ["since"],
            properties: {
                since: { type: "string", format: "date-time", description: "From when" },
                direction: { type: "string", enum: ["in", "out"] },
                tags: { type: "array", items: { type: "string" } },
                note: { type: ["string", "null"] },
                anything: {},
            },
        }

        expect(policy.membersOf(schema).map((member) => [member.name, member.type, member.format, member.required, member.choices, member.description])).toEqual([
            ["since", "string", "date-time", true, [], "From when"],
            ["direction", "string", null, false, ["in", "out"], null],
            ["tags", "array<string>", null, false, [], null],
            ["note", "string|null", null, false, [], null],
            ["anything", null, null, false, [], null],
        ])
        expect(policy.membersOf(schema).every((member) => member.label === null && !member.filterable)).toBe(true)
    })

    it("has no members for a schema that is no object with properties", async () => {
        const policy = await build()
        expect([policy.membersOf(null), policy.membersOf({ type: "string" }), policy.membersOf("text")]).toEqual([[], [], []])
    })
})

describe("level 1", () => {
    it("documents the info read of a provider under its API verb: synced, one connection id in, the generic account state out, no prose", async () => {
        const policy = await build()
        const info = policy.infoReadOf(API.sepay.info)

        expect(info).toMatchObject({ name: "nivo.api.sepay.info", kind: "read", shape: "info", freshness: "synced", summary: null })
        expect(info.parameters.map((member) => [member.name, member.type, member.format, member.required])).toEqual([
            ["connectionId", "string", "uuid", true],
        ])
        expect(info.returns.map((member) => [member.name, member.choices])).toEqual([
            ["connectionId", []],
            ["state", ["ok", "attention", "off"]],
            ["figures", []],
            ["asOf", []],
        ])
    })

    it("documents a registered read under its API verb with the provider's freshness", async () => {
        const policy = await build()
        const read = policy.interfaceReadOf(
            API.sepay.rights,
            { name: "rights", shape: "page", input: { type: "object", properties: { limit: { type: "integer" } } }, output: null },
            "synced",
        )

        expect(read).toEqual({
            name: "nivo.api.sepay.rights",
            kind: "read",
            shape: "page",
            freshness: "synced",
            summary: null,
            parameters: [expect.objectContaining({ name: "limit", type: "integer" })],
            returns: [],
        })
    })

    it("generates the Swagger reads from the PINNED document: every GET operation of an open source by its API read, page or record by the 200 answer", async () => {
        const policy = await build()
        const pin = policy.swaggerPinOf(pinnedMeta(), () => CRM_DECLARATIONS)
        expect(pin).not.toBeNull()
        if (pin === null) return

        const reads = policy.swaggerReadsOf(pin, new Set([CONNECTOR]))

        // In the order of the pinned (canonical) document: its paths by code point.
        expect(reads.map((read) => [read.name, read.shape, read.freshness])).toEqual([
            [`nivo.api.${CONNECTOR}.get.customers`, "page", "live"],
            [`nivo.api.${CONNECTOR}.get.customers.code`, "record", "live"],
        ])
        // The workspace header is the provider's, never a parameter a screen sends.
        expect(reads.map((read) => read.parameters.map((member) => member.name))).toEqual([["q"], ["code"]])
        expect(reads.map((read) => read.returns.map((member) => member.name))).toEqual([["code"], ["code", "name"]])
        expect(policy.swaggerReadsOf(pin, new Set(["other"]))).toEqual([])
    })

    it("reads no pin from an account that pinned nothing", async () => {
        const policy = await build()
        expect(policy.swaggerPinOf({}, () => CRM_DECLARATIONS)).toBeNull()
    })
})

describe("level 2", () => {
    it("takes the kind from the gateway spec, else the plugin definition, else the catalogue scope", async () => {
        const policy = await build()
        expect(policy.offeredToolOf(bare({ specScope: "restricted", mutates: false })).kind).toBe("write")
        expect(policy.offeredToolOf(bare({ specScope: "read", abilityScope: "write" })).kind).toBe("read")
        expect(policy.offeredToolOf(bare({ mutates: true })).kind).toBe("write")
        expect(policy.offeredToolOf(bare({ abilityScope: "write" })).kind).toBe("write")
    })

    it("documents parameters from the gateway spec first, returns from the definition, and no effect where none is declared", async () => {
        const policy = await build()
        const tool = policy.offeredToolOf(
            bare({
                description: "Lists bank transactions.",
                inputSchema: { type: "object", properties: { since: { type: "string" } } },
                argsSchema: { type: "object", properties: { ignored: { type: "string" } } },
                resultSchema: { type: "object", properties: { items: { type: "array" } } },
            }),
        )

        expect(tool).toMatchObject({ effect: null, operation: null, title: null, summary: null, description: "Lists bank transactions." })
        expect(policy.offeredToolOf(bare({ declaredEffect: "irreversible" })).effect).toBe("irreversible")
        expect(tool.parameters.map((member) => member.name)).toEqual(["since"])
        expect(tool.returns.map((member) => member.name)).toEqual(["items"])
        expect(policy.offeredToolOf(bare({ argsSchema: { type: "object", properties: { code: {} } } })).parameters.map((member) => member.name)).toEqual(["code"])
    })

    it("gives a Swagger tool its method, path, state and the effect the DOCUMENT marks", async () => {
        const policy = await build()
        const pin = policy.swaggerPinOf(pinnedMeta(), () => CRM_DECLARATIONS)
        const stateOf = (tool: string) => pin?.states.find((state) => state.tool === tool) ?? null

        const money = policy.offeredToolOf(bare({ id: toolOf("post.renewals"), pinned: stateOf(toolOf("post.renewals")) }))
        const read = policy.offeredToolOf(bare({ id: toolOf("get.customers.code"), pinned: stateOf(toolOf("get.customers.code")) }))
        const gone = policy.offeredToolOf(bare({ id: toolOf("get.gone"), pinned: stateOf(toolOf("get.gone")) }))

        expect(money).toMatchObject({ effect: "money", operation: { method: "POST", path: "/renewals", state: "ready" } })
        expect(read).toMatchObject({ effect: null, operation: { method: "GET", path: "/customers/{code}", state: "ready" } })
        expect(gone).toMatchObject({ effect: null, operation: { method: null, path: null, state: "missing" } })
        // The document's mark wins over a mark declared elsewhere for the same id.
        expect(policy.offeredToolOf(bare({ pinned: stateOf(toolOf("post.renewals")), declaredEffect: "none" })).effect).toBe("money")
    })
})

describe("level 3", () => {
    it("documents the bank and mailbox triggers as the catalogue declares them", async () => {
        const policy = await build()
        const sepay = policy.offeredTriggersOf(triggersOf("sepay"))
        const imap = policy.offeredTriggersOf(triggersOf("imap"))

        expect(sepay).toEqual([
            expect.objectContaining({
                name: "transaction.received",
                kind: "webhook",
                batching: { mode: "each", maxEvents: null },
                recovery: "reconcile",
                decided: true,
            }),
        ])
        expect(sepay[0]?.payload.map((member) => [member.name, member.type, member.choices, member.filterable])).toEqual([
            ["transactionId", "id", [], false],
            ["direction", "choice", ["in", "out"], true],
        ])
        expect(sepay[0]?.payload.every((member) => member.label !== null && member.required)).toBe(true)
        expect(imap).toEqual([
            expect.objectContaining({ name: "mail.received", kind: "poll", batching: { mode: "list", maxEvents: 50 }, recovery: "cursor", decided: false }),
        ])
        expect(policy.offeredTriggersOf([])).toEqual([])
    })
})
