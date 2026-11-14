import { ToolsErrorCode } from "@modules/domain/tools"
import { proofOf } from "@modules/domain/provider-registry"
import { ok } from "@modules/platform/primitives"
import fixture from "./openapi-native.service.fixtures.json"
import { OpenApiConnectorService, openApiManifestOf } from "./openapi-native.service"
import {
    WORKSPACE,
    ACCOUNT,
    KEY,
    CALLER,
    CUSTOMER,
    CRM,
    SOURCES,
    connection,
    metaOf,
    build,
    opOf,
    refusal,
} from "@tests/fixtures/builders/openapi-native.builder"

/** The tools of the connector the cases call, by their name inside it: the generated operation names, minus the CRM's prefix. */
const GET_CUSTOMER = "get.customers.code"
const FIND_CUSTOMERS = "get.customers"

describe("OpenApiConnectorService manifest", () => {
    it("lists only the declared operations as tools, in the plugin's words, never the document's", () => {
        const manifest = openApiManifestOf(CRM, SOURCES)

        // Every answer is the response policy's envelope: the mark the node door reads (by the source, never by the shape).
        expect(manifest).toMatchObject({ key: "crm.nivoweb", namespace: "nivo.api.crm.nivoweb", answers: "envelope" })
        expect(manifest.tools.map((tool) => tool.name)).toEqual(SOURCES.map((source) => source.declaration.name))
        expect(manifest.tools.map((tool) => tool.name)).not.toContain("post.renewals.id.confirm")
        expect(manifest.tools[0]).toMatchObject({ description: "Reads one customer.", scope: "read", defaultMode: "auto" })
        expect(manifest.tools[2]).toMatchObject({ scope: "write", defaultMode: "ask" })
    })

    it("masks every text argument and the whole answer in the audit, and takes a JSON object as arguments", () => {
        const [get, find] = openApiManifestOf(CRM, SOURCES).tools

        expect(find?.secretFields).toEqual(["data", "message", "q", "cursor"])
        expect(get?.argumentSchema.safeParse({ code: "ACME" }).success).toBe(true)
        expect(get?.argumentSchema.safeParse("text").success).toBe(false)
    })

    it("knows no operation a plugin did not declare, even one the document holds", async () => {
        const { connector, call } = build()

        await expect(connector.invoke(WORKSPACE, "post.renewals.id.confirm", { id: "r-1", confirmedBy: "x" }, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.UnknownTool,
        })
        expect(call).not.toHaveBeenCalled()
    })
})

describe("OpenApiConnectorService read", () => {
    it("calls the operation on the attached account with the workspace header and the sealed key, and answers what the document declares", async () => {
        const { connector, call, accountsOfAgent, secretOf } = build()
        call.mockResolvedValue({ status: 200, headers: {}, text: JSON.stringify({ ...CUSTOMER, secretNote: "undeclared" }) })

        const answer = await connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)

        expect(accountsOfAgent).toHaveBeenCalledWith(WORKSPACE, "agent-1", opOf("get.customers.code"))
        expect(secretOf).toHaveBeenCalledWith(ACCOUNT, "openapi")
        expect(call).toHaveBeenCalledWith({
            baseUrl: "https://crm.example.test",
            op: {
                id: "customer.get",
                method: "GET",
                path: "/v1/customers/{code}",
                summary: "",
                params: [
                    { name: "X-Workspace-Id", in: "header", required: true },
                    { name: "code", in: "path", required: true },
                ],
                hasBody: false,
            },
            auth: { type: "header", name: "X-Crm-Service-Key", value: KEY, user: "", password: "" },
            input: { "X-Workspace-Id": WORKSPACE, code: "ACME" },
            maxBytes: 1_000_000,
        })
        expect(answer).toMatchObject({ ok: true, status: 200, data: CUSTOMER, truncated: false })
        expect(JSON.stringify(answer)).not.toContain(KEY)
        expect(JSON.stringify(answer)).not.toContain("undeclared")
    })

    it("passes the cursor through and says when a page was cut", async () => {
        const { connector, call } = build()
        const items = Array.from({ length: 40 }, (_, index) => ({ code: `C${index}`, name: "n".repeat(480), reachable: true }))
        call.mockResolvedValue({ status: 200, headers: {}, text: JSON.stringify({ items, nextCursor: "c3" }) })

        const answer = await connector.invoke(WORKSPACE, FIND_CUSTOMERS, { q: "an", cursor: "c2" }, CALLER)

        expect(call.mock.calls[0]?.[0].input).toEqual({ "X-Workspace-Id": WORKSPACE, q: "an", cursor: "c2" })
        expect(answer).toMatchObject({ ok: true, truncated: true, data: { nextCursor: null } })
        expect(Number(answer.omitted)).toBeGreaterThan(0)
    })

    it("hands a refusal of the outside system on as a fact and fails when it is unavailable", async () => {
        const { connector, call } = build()
        call.mockResolvedValueOnce({ status: 404, headers: {}, text: JSON.stringify({ code: "CUSTOMER_NOT_FOUND", message: "No such customer" }) })
        call.mockResolvedValueOnce({ status: 503, headers: {}, text: "" })

        await expect(connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "NOPE" }, CALLER)).resolves.toMatchObject({
            ok: false,
            status: 404,
            code: "CUSTOMER_NOT_FOUND",
            message: "No such customer",
        })
        await expect(connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject({
            code: "DATA_SOURCES_UNAVAILABLE",
            params: { detail: "http_503" },
        })
    })
})

describe("OpenApiConnectorService failure proofs", () => {
    /** What a call's failure proves, or the answer when it did not fail. */
    const proofOfCall = (world: ReturnType<typeof build>, args: Readonly<Record<string, unknown>> = { code: "ACME" }) =>
        world.connector.invoke(WORKSPACE, GET_CUSTOMER, args, CALLER).then(
            () => "answered",
            (cause: unknown) => proofOf(cause),
        )

    it("says not_sent for what fails before the request is handed to the client", async () => {
        const detached = build()
        detached.accountsOfAgent.mockResolvedValue([])
        const local = build(metaOf({ baseUrl: "http://127.0.0.1:9000" }))
        const badArgs = build()

        await expect(proofOfCall(detached)).resolves.toBe("not_sent")
        await expect(proofOfCall(local)).resolves.toBe("not_sent")
        await expect(proofOfCall(badArgs, { code: 7 })).resolves.toBe("not_sent")
        expect(detached.call).not.toHaveBeenCalled()
    })

    it("says unknown for a failure of the client and for a 5xx answer, and nothing for a 4xx refusal", async () => {
        const broken = build()
        broken.call.mockRejectedValueOnce(new Error("socket hang up"))
        const busy = build()
        busy.call.mockResolvedValueOnce({ status: 503, headers: {}, text: "" })
        const refused = build()
        refused.call.mockResolvedValueOnce({ status: 404, headers: {}, text: JSON.stringify({ code: "X", message: "x" }) })

        await expect(proofOfCall(broken)).resolves.toBe("unknown")
        await expect(proofOfCall(busy)).resolves.toBe("unknown")
        await expect(proofOfCall(refused)).resolves.toBe("answered")
    })
})

describe("OpenApiConnectorService account", () => {
    it("serves only an open account of its connector that the calling agent is attached to", async () => {
        const detached = build()
        detached.accountsOfAgent.mockResolvedValue([])
        const other = build(metaOf({ connector: "crm.erp" }))
        const closed = build()
        closed.ofProvider.mockResolvedValue([connection(ACCOUNT, "disconnected")])

        await expect(detached.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("not_connected"))
        await expect(other.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("not_connected"))
        await expect(closed.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("not_connected"))
        expect(detached.call).not.toHaveBeenCalled()
    })

    it("runs on the account the tool runner handed when it meets the rules, and refuses one that does not", async () => {
        const OTHER = "8f8f2c1e-0000-4000-8000-00000000c002"
        const world = build()
        world.ofProvider.mockResolvedValue([connection(ACCOUNT), connection(OTHER)])
        world.accountsOfAgent.mockResolvedValue([ACCOUNT, OTHER])

        await world.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, { ...CALLER, connectionId: OTHER })
        expect(world.ports.bindings.recordOf).toHaveBeenCalledWith(WORKSPACE, OTHER)
        expect(world.secretOf).toHaveBeenLastCalledWith(OTHER, expect.anything())

        world.accountsOfAgent.mockResolvedValue([ACCOUNT])
        await expect(
            world.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, { ...CALLER, connectionId: OTHER }),
        ).rejects.toMatchObject(refusal("not_connected"))
    })

    it("refuses a key it cannot open, a key of another workspace, and an app that makes no outbound call", async () => {
        const foreign = build()
        foreign.secretOf.mockResolvedValue(ok({ workspaceId: "other", credential: JSON.stringify({ value: KEY }), webhookSecret: "", tokenExpiresAt: null }))
        const { ports } = build()
        const unserved = new OpenApiConnectorService(CRM, SOURCES, { bindings: ports.bindings, clock: ports.clock })

        await expect(foreign.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("connection_refused"))
        expect(foreign.call).not.toHaveBeenCalled()
        await expect(unserved.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("not_served"))
    })
})

describe("OpenApiConnectorService write", () => {
    const ARGS = { code: "ACME-HOST", termMonths: 12, dryRun: false }
    const RENEWAL = { status: 201, headers: {}, text: JSON.stringify({ id: "r-1", state: "would_renew", dryRun: true }) }

    it("runs a write as a dry run on an account that is not live, under a replay key of the step", async () => {
        const { connector, call } = build()
        call.mockResolvedValue(RENEWAL)

        const answer = await connector.invoke(WORKSPACE, "post.services.code.renewals", ARGS, CALLER)
        await connector.invoke(WORKSPACE, "post.services.code.renewals", ARGS, CALLER)
        const [first, second] = call.mock.calls.map(([sent]) => sent.input)

        expect(first?.body).toEqual({ termMonths: 12, dryRun: true })
        expect(first?.["Idempotency-Key"]).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(second?.["Idempotency-Key"]).toBe(first?.["Idempotency-Key"])
        expect(answer).toMatchObject({ ok: true, status: 201, dryRun: true, dryRunForced: true })
    })

    it("acts for real only on a live account and an explicit dryRun false", async () => {
        const { connector, call } = build(metaOf({ live: true }))
        call.mockResolvedValue({ ...RENEWAL, text: JSON.stringify({ id: "r-1", state: "pending_person", dryRun: false }) })

        const answer = await connector.invoke(WORKSPACE, "post.services.code.renewals", ARGS, CALLER)

        expect(call.mock.calls[0]?.[0].input.body).toEqual({ termMonths: 12, dryRun: false })
        expect(answer).toMatchObject({ dryRun: false })
        expect(answer.dryRunForced).toBeUndefined()
    })

    it("refuses a write that has no step key: it could act twice", async () => {
        const { connector, call } = build()

        await expect(
            connector.invoke(WORKSPACE, "post.services.code.renewals", ARGS, { agentId: "agent-1", conversationId: null, connectionId: ACCOUNT }),
        ).rejects.toMatchObject({ code: ToolsErrorCode.InvalidArguments })
        expect(call).not.toHaveBeenCalled()
    })
})

describe("OpenApiConnectorService pin", () => {
    it("stops every tool when the stored document is not the pinned one, or none is pinned", async () => {
        const edited = build(metaOf({ document: JSON.stringify({ ...fixture, info: { ...fixture.info, version: "9.9.9" } }) }))
        const broken = build(metaOf({ document: "not a document" }))
        const { agentDocument: _dropped, ...unpinnedMeta } = metaOf()
        const unpinned = build(unpinnedMeta)

        await expect(edited.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("document_changed"))
        await expect(broken.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("document_changed"))
        await expect(unpinned.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("document_unpinned"))
        expect(edited.call).not.toHaveBeenCalled()
    })

    it("stops every tool when the live document changed, looking at most once in ten minutes", async () => {
        const { connector, call, fetchSpec, now } = build()
        fetchSpec.mockResolvedValue(JSON.stringify({ ...fixture, paths: { ...fixture.paths, "/v1/new": {} } }))

        await expect(connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("document_changed"))
        await expect(connector.invoke(WORKSPACE, FIND_CUSTOMERS, { q: "an" }, CALLER)).rejects.toMatchObject(refusal("document_changed"))
        expect(fetchSpec).toHaveBeenCalledTimes(1)
        expect(fetchSpec).toHaveBeenCalledWith("https://crm.example.test/openapi.json")
        now.ms += 600_000
        fetchSpec.mockResolvedValue(JSON.stringify(fixture, null, 2))
        await expect(connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).resolves.toMatchObject({ ok: true })
        expect(fetchSpec).toHaveBeenCalledTimes(2)
        expect(call).toHaveBeenCalledTimes(1)
    })

    it("looks at the live document where the account was pinned from (its Swagger URL), and at the base URL's own document when it was pinned as text", async () => {
        const swagger = build(metaOf({ swaggerUrl: "https://crm.example.test/v1/openapi.json" }))
        const text = build()

        await expect(swagger.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).resolves.toMatchObject({ ok: true })
        await expect(text.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).resolves.toMatchObject({ ok: true })

        expect(swagger.fetchSpec).toHaveBeenCalledWith("https://crm.example.test/v1/openapi.json")
        expect(text.fetchSpec).toHaveBeenCalledWith("https://crm.example.test/openapi.json")
    })

    it("does not judge a live document it cannot read; the answer is still checked against the pinned one", async () => {
        const { connector, call, fetchSpec } = build()
        fetchSpec.mockRejectedValue(new Error("down"))
        call.mockResolvedValue({ status: 200, headers: {}, text: JSON.stringify({ code: "ACME" }) })

        await expect(connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("response_mismatch"))
    })
})

describe("OpenApiConnectorService refusals of an operation", () => {
    it("refuses an unsupported operation, a missing one and a read declared on a write, before any request", async () => {
        const { connector, call } = build()

        await expect(connector.invoke(WORKSPACE, "get.tickets", {}, CALLER)).rejects.toMatchObject(refusal("operation_unsupported"))
        await expect(connector.invoke(WORKSPACE, "post.tickets.id.close", { id: "t-1" }, CALLER)).rejects.toMatchObject(refusal("crm_op_missing"))
        await expect(
            connector.invoke(WORKSPACE, "post.services.code.reminders", { code: "ACME-HOST", outcome: "asked" }, CALLER),
        ).rejects.toMatchObject(refusal("operation_mode_mismatch"))
        expect(call).not.toHaveBeenCalled()
    })

    it("refuses arguments that do not fit the plugin's validator or the document's own schemas", async () => {
        const { connector, call } = build()

        await expect(connector.invoke(WORKSPACE, FIND_CUSTOMERS, { q: "an", limit: 500 }, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.InvalidArguments,
        })
        await expect(connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME", "X-Workspace-Id": "other" }, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.InvalidArguments,
        })
        expect(call).not.toHaveBeenCalled()
    })
})

describe("OpenApiConnectorService reachability", () => {
    const LOCAL = metaOf({ baseUrl: "http://127.0.0.1:3106" })

    it("refuses this machine and plain http outside a development site", async () => {
        const local = build(LOCAL)
        const plain = build(metaOf({ baseUrl: "http://crm.example.test" }))

        await expect(local.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("host_not_allowed"))
        await expect(plain.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("host_not_allowed"))
        expect(local.call).not.toHaveBeenCalled()
        expect(local.secretOf).not.toHaveBeenCalled()
    })

    it("reaches this machine on a development site, and no other private address", async () => {
        const local = build(LOCAL, true)
        local.resolve.mockResolvedValue({ address: "127.0.0.1", family: 4 })
        const lan = build(metaOf({ baseUrl: "https://crm.internal.example.test" }), true)
        lan.resolve.mockResolvedValue({ address: "10.0.0.5", family: 4 })

        await expect(local.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).resolves.toMatchObject({ ok: true })
        expect(local.call.mock.calls[0]?.[0].baseUrl).toBe("http://127.0.0.1:3106")
        await expect(lan.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("host_not_allowed"))
        expect(lan.call).not.toHaveBeenCalled()
    })

    it("refuses a public name that resolves to a private address", async () => {
        const { connector, call, resolve } = build()
        resolve.mockResolvedValue({ address: "192.168.1.20", family: 4 })

        await expect(connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject(refusal("host_not_allowed"))
        expect(call).not.toHaveBeenCalled()
    })
})

describe("OpenApiConnectorService viewer", () => {
    it("lists every supported GET operation of the pinned document by its API read, with its schemas, and no write or unsupported one", async () => {
        const { connector, accountsOfAgent } = build()

        const reads = await connector.viewerReads(WORKSPACE)

        // In the order of the pinned (canonical) document: its paths by code point.
        expect(reads.map((read) => read.name)).toEqual([
            "nivo.api.crm.nivoweb.get.customers",
            "nivo.api.crm.nivoweb.get.customers.code",
            "nivo.api.crm.nivoweb.get.services.expiring",
        ])
        expect(reads[0]?.input).toMatchObject({ required: ["q"], additionalProperties: false })
        expect(reads[1]?.output).toMatchObject({ type: "object", required: ["code", "name", "reachable"] })
        expect(accountsOfAgent).not.toHaveBeenCalled()
    })

    it("runs a read for a person by its API read through the same client, key and workspace header, with paging passed through", async () => {
        const { connector, call } = build()
        call.mockResolvedValue({ status: 200, headers: {}, text: JSON.stringify({ items: [CUSTOMER], nextCursor: "c3" }) })

        const answer = await connector.viewerRead(WORKSPACE, "nivo.api.crm.nivoweb.get.customers", { q: "an", cursor: "c2", limit: 20 })

        expect(call.mock.calls[0]?.[0].input).toEqual({ "X-Workspace-Id": WORKSPACE, q: "an", cursor: "c2", limit: 20 })
        expect(call.mock.calls[0]?.[0].auth.value).toBe(KEY)
        expect(answer).toMatchObject({ ok: true, data: { items: [CUSTOMER], nextCursor: "c3" } })
    })

    it("refuses a tool id, a write, an unsupported or absent operation, another source, and arguments the document does not take", async () => {
        const { connector, call } = build()

        await expect(connector.viewerRead(WORKSPACE, "nivo.tool.invoice.create", { q: "an" })).rejects.toMatchObject(refusal("not_selected"))
        await expect(connector.viewerRead(WORKSPACE, "nivo.api.crm.nivoweb.post.services.code.renewals", { code: "A", termMonths: 1 })).rejects.toMatchObject(refusal("not_selected"))
        await expect(connector.viewerRead(WORKSPACE, "nivo.api.crm.nivoweb.get.tickets", {})).rejects.toMatchObject(refusal("not_selected"))
        await expect(connector.viewerRead(WORKSPACE, "nivo.api.crm.nivoweb.get.orders", {})).rejects.toMatchObject(refusal("not_selected"))
        await expect(connector.viewerRead(WORKSPACE, "nivo.api.crm.erp.get.customers", { q: "an" })).rejects.toMatchObject(refusal("not_selected"))
        await expect(connector.viewerRead(WORKSPACE, "nivo.api.crm.nivoweb.get.customers", { q: "an", extra: 1 })).rejects.toMatchObject({
            code: ToolsErrorCode.InvalidArguments,
        })
        expect(call).not.toHaveBeenCalled()
    })

    it("reads nothing in a workspace that has no account, and stops when the document is not the pinned one", async () => {
        const other = build()
        other.ofProvider.mockResolvedValue([])
        const edited = build(metaOf({ document: JSON.stringify({ ...fixture, info: { ...fixture.info, version: "9.9.9" } }) }))

        await expect(other.connector.viewerRead("another-workspace", "nivo.api.crm.nivoweb.get.customers.code", { code: "ACME" })).rejects.toMatchObject(refusal("not_connected"))
        expect(other.ofProvider).toHaveBeenCalledWith("another-workspace", "openapi", 20)
        await expect(edited.connector.viewerRead(WORKSPACE, "nivo.api.crm.nivoweb.get.customers.code", { code: "ACME" })).rejects.toMatchObject(refusal("document_changed"))
        await expect(edited.connector.viewerReads(WORKSPACE)).rejects.toMatchObject(refusal("document_changed"))
        expect(edited.call).not.toHaveBeenCalled()
    })
})

// #10b (ARCH-REVIEW 2026-11-12 S7): no silent pick. An agent's call that the runner handed no account is refused `not_connected` for
// a write or a single-account operation, never run on "the oldest open account"; an `each` read covers every held account, so it runs
// only when exactly one is held (several: `not_selected`, the adapter answers one account and never merges). The engine's own caller
// and a person's read keep one deterministic rule: exactly one open account of the source, that one; several, `not_selected`; none,
// `not_connected`.
describe("OpenApiConnectorService account: no silent pick", () => {
    const OTHER = "8f8f2c1e-0000-4000-8000-00000000c002"
    const UNHANDED = { agentId: "agent-1", conversationId: null, opKey: "run-1:step-1" }
    const ENGINE = { ...UNHANDED, engine: true as const }

    it("an agent's write with no account handed: refused not_connected, even with one open account it holds; nothing is sent", async () => {
        const world = build()

        const renewal = { code: "ACME-HOST", termMonths: 12, dryRun: false }
        await expect(world.connector.invoke(WORKSPACE, "post.services.code.renewals", renewal, UNHANDED)).rejects.toMatchObject(
            refusal("not_connected"),
        )
        expect(world.call).not.toHaveBeenCalled()
    })

    it("an agent's read of a CRM operation with no account handed: refused not_connected, one held account or two (an operation of a pinned document is handed ONE account by the runner, never run on a pick)", async () => {
        const one = build()
        await expect(one.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, UNHANDED)).rejects.toMatchObject(
            refusal("not_connected"),
        )

        const two = build()
        two.ofProvider.mockResolvedValue([connection(ACCOUNT), connection(OTHER)])
        two.accountsOfAgent.mockResolvedValue([ACCOUNT, OTHER])
        await expect(two.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, UNHANDED)).rejects.toMatchObject(
            refusal("not_connected"),
        )
        expect(one.call).not.toHaveBeenCalled()
        expect(two.call).not.toHaveBeenCalled()
    })

    it("the engine's own caller with no account handed: exactly one open account, that one; two, not_selected; none, not_connected", async () => {
        const one = build()
        await expect(one.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, ENGINE)).resolves.toMatchObject({
            ok: true,
        })

        const two = build()
        two.ofProvider.mockResolvedValue([connection(ACCOUNT), connection(OTHER)])
        await expect(two.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, ENGINE)).rejects.toMatchObject(
            refusal("not_selected"),
        )
        expect(two.call).not.toHaveBeenCalled()

        const none = build()
        none.ofProvider.mockResolvedValue([])
        await expect(none.connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, ENGINE)).rejects.toMatchObject(
            refusal("not_connected"),
        )
    })

    it("a person's read with two open accounts of the source: not_selected, nothing read", async () => {
        const two = build()
        two.ofProvider.mockResolvedValue([connection(ACCOUNT), connection(OTHER)])

        await expect(two.connector.viewerRead(WORKSPACE, "nivo.api.crm.nivoweb.get.customers.code", { code: "ACME" })).rejects.toMatchObject(
            refusal("not_selected"),
        )
        expect(two.call).not.toHaveBeenCalled()
    })
})
