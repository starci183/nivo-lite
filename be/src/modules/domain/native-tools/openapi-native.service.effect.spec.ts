import type { ConnectionStatusFacts } from "@modules/domain/connections"
import type { NativeCaller } from "@modules/domain/tools"
import { pinOf, readDocument, type OpenApiToolDeclaration } from "@modules/domain/openapi-tools"
import { ok } from "@modules/platform/primitives"
import { OpenApiConnectorService, type OpenApiConnectorPorts, type OpenApiToolSource } from "./openapi-native.service"

const WORKSPACE = "7b0f0a52-1111-4222-8333-444455556666"
const ACCOUNT = "8f8f2c1e-0000-4000-8000-00000000c001"
// The agent of a step with the account the tool runner handed it (an agent write with none handed is refused: ARCH-REVIEW S7).
/** The provider key of the CRM the document is pinned for. */
const CRM = "crm.nivoweb"
const CALLER = { agentId: "agent-1", conversationId: null, opKey: "run-1:step-1", connectionId: ACCOUNT }

/**
 * One write of the synthetic document: a POST taking a note, served under its generated name (`nivo.api.crm.nivoweb.post.<path>`), with
 * the effect mark a case gives it (none when left out).
 */
const writeOf = (operationId: string, effect?: unknown): Record<string, unknown> => ({
    post: {
        operationId,
        ...(effect === undefined ? {} : { "x-nivo-effect": effect }),
        parameters: [
            { name: "X-Workspace-Id", in: "header", required: true, schema: { type: "string", format: "uuid" } },
            { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } },
        ],
        requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["note"], properties: { note: { type: "string" } } } } },
        },
        responses: {
            "201": {
                description: "Made",
                content: { "application/json": { schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } } },
            },
        },
    },
})

/** A synthetic CRM whose writes carry every mark: none, money, irreversible, no mark at all, and a mark that is no mark. */
const DOCUMENT = {
    openapi: "3.0.3",
    info: { title: "Synthetic CRM", version: "1.0.0" },
    servers: [{ url: "https://crm.example.test/v1" }],
    security: [{ serviceKey: [] }],
    paths: {
        "/v1/notes": writeOf("note.record", "none"),
        "/v1/refunds": writeOf("refund.create", "money"),
        "/v1/closures": writeOf("account.close", "irreversible"),
        "/v1/tickets": writeOf("ticket.create"),
        "/v1/odd": writeOf("odd.record", "harmless"),
    },
    components: { securitySchemes: { serviceKey: { type: "apiKey", in: "header", name: "X-Crm-Service-Key" } } },
}

/** Every write is declared by the plugin; the document's mark alone must change nothing about whether it runs. */
const auto = (name: string): OpenApiToolSource => {
    const declaration: OpenApiToolDeclaration = {
        tool: `nivo.api.${CRM}.${name}`,
        connector: CRM,
        name,
        reads: false,
    }
    return {
        declaration,
        args: { safeParse: () => ({ success: true }) },
        inputSchema: { type: "object", properties: { note: { type: "string" } } },
        description: "A write.",
    }
}

const SOURCES = ["post.notes", "post.refunds", "post.closures", "post.tickets", "post.odd"].map(auto)

/** The writes of the second synthetic system (see `SALES_DOCUMENT`). */
const SALES_SOURCES = ["post.customers", "post.renewals", "post.purchases"].map(auto)

const connection: ConnectionStatusFacts = {
    id: ACCOUNT,
    provider: "openapi",
    name: "CRM",
    status: "connected",
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    botUsername: null,
    accountMasked: null,
    lastError: null,
    oaId: null,
    email: null,
}

const metaOf = (document: object = DOCUMENT): Record<string, string> => {
    const pinning = pinOf(
        {
            documentText: JSON.stringify(document),
            connector: CRM,
            swaggerUrl: "",
            workspaceHeader: "X-Workspace-Id",
            live: false,
            pinnedBy: "member-1",
            pinnedAt: "2026-11-12T00:00:00.000Z",
        },
        [...SOURCES, ...SALES_SOURCES].map((source) => source.declaration),
    )
    return {
        config: JSON.stringify({ v: 1, baseUrl: "https://crm.example.test", authType: "header", authName: "X-Crm-Service-Key" }),
        ...(pinning.ok ? pinning.meta : {}),
    }
}

/** A connector over scripted ports whose rights board can only say which accounts an agent holds: it has no `judge`, so a connector that asked a person would fail the call. */
const build = (document: object = DOCUMENT, sources: ReadonlyArray<OpenApiToolSource> = SOURCES) => {
    const call = jest.fn().mockResolvedValue({ status: 201, headers: {}, text: JSON.stringify({ id: "made-1" }) })
        const ports: OpenApiConnectorPorts = {
        bindings: {
            ofProvider: jest.fn().mockResolvedValue([connection]),
            recordOf: jest.fn().mockResolvedValue({ meta: metaOf(document) }),
        },
        clock: { now: () => new Date("2026-11-12T04:00:00.000Z") },
        secrets: {
            secretOf: jest.fn().mockResolvedValue(
                ok({
                    workspaceId: WORKSPACE,
                    credential: JSON.stringify({ type: "header", name: "X-Crm-Service-Key", value: "sealed" }),
                    webhookSecret: "",
                    tokenExpiresAt: null,
                }),
            ),
        },
        client: { call, fetchSpec: jest.fn().mockResolvedValue(JSON.stringify(document)) },
        host: { allowsPrivate: () => false, resolve: jest.fn().mockResolvedValue({ address: "203.0.113.9", family: 4 }) },
        abilities: { accountsOfAgent: jest.fn().mockResolvedValue([ACCOUNT]) },
    }
    return { connector: new OpenApiConnectorService(CRM, sources, ports), call }
}

describe("the effect mark of an operation (x-nivo-effect)", () => {
    it("is read from the document as a typed member; a write without one has none, and another value makes the operation unsupported", () => {
        const reading = readDocument(JSON.stringify(DOCUMENT), CRM)
        const operations = reading.ok ? reading.document.operations : new Map<string, never>()

        expect([...operations.values()].map((operation) => [operation.operationId, operation.effect])).toEqual([
            ["note.record", "none"],
            ["refund.create", "money"],
            ["account.close", "irreversible"],
            ["ticket.create", null],
            ["odd.record", null],
        ])
        expect(operations.get("nivo.api.crm.nivoweb.post.odd")?.unsupported).toEqual(["effect mark is not money, irreversible or none"])
        expect(operations.get("nivo.api.crm.nivoweb.post.tickets")?.unsupported).toEqual([])
    })
})

describe("OpenApiConnectorService: the connector asks nobody; the node's declared mode decides (rights.md rules 2 and 5)", () => {
    it.each(["post.notes", "post.tickets", "post.refunds", "post.closures"])(
        "runs the write %s by itself whatever its effect mark says (none, unmarked, money, irreversible): no floor, no rights question",
        async (name) => {
            const { connector, call } = build()

            await expect(connector.invoke(WORKSPACE, name, { note: "n" }, CALLER)).resolves.toMatchObject({ ok: true })

            expect(call).toHaveBeenCalledTimes(1)
        },
    )

    it("never runs a write whose mark is no mark", async () => {
        const { connector, call } = build()

        await expect(connector.invoke(WORKSPACE, "post.odd", { note: "n" }, CALLER)).rejects.toMatchObject({
            params: { reason: "operation_unsupported" },
        })
        expect(call).not.toHaveBeenCalled()
    })
})

describe("OpenApiConnectorService: a CRM write called by a node declared auto RUNS", () => {
    /** A second synthetic system: it opens a customer (irreversible), renews a service (money) and changes a request (marked none). */
    const SALES_DOCUMENT = {
        ...DOCUMENT,
        paths: {
            "/v1/customers": writeOf("customer.create", "irreversible"),
            "/v1/renewals": writeOf("renewal.create", "money"),
            "/v1/purchases": writeOf("purchase.update", "none"),
        },
    }
    /** The same caller as a workflow step: the node's mode is judged by the engine's ToolRunner before the connector is called. */
    const NODE_CALLER: NativeCaller = {
        ...CALLER,
        graphStep: true,
        origin: "node",
        node: { nodeKey: "accept", versionId: "version-3", workflowId: "workflow-1" },
    }

    it.each(["post.customers", "post.renewals", "post.purchases"])(
        "runs %s for the agent and for the step's node",
        async (name) => {
            const agent = build(SALES_DOCUMENT, SALES_SOURCES)
            const node = build(SALES_DOCUMENT, SALES_SOURCES)

            await expect(agent.connector.invoke(WORKSPACE, name, { note: "n" }, CALLER)).resolves.toMatchObject({ ok: true })
            await expect(node.connector.invoke(WORKSPACE, name, { note: "n" }, NODE_CALLER)).resolves.toMatchObject({ ok: true })

            expect(agent.call).toHaveBeenCalledTimes(1)
            expect(node.call).toHaveBeenCalledTimes(1)
        },
    )
})
