import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { CallLogRecord } from "@modules/domain/mcp-call-log"
import type { McpConnectorRow } from "@modules/domain/mcp-connectors"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.service"
import { argsHashOf } from "./audit-mask.policy"
import {
    modeOf,
    remoteConnectorOf,
    nativeConnectorOf,
    approvalOf,
    constraintsOf,
    constraintsOfJson,
    grantOf,
    grantViewOf,
    callLogViewOf,
    catalogEntryOf,
} from "./connector-row.mapper"
import type { NativeAdapter } from "./mcp-gateway.contracts"

/** The members of the subject under test. */
interface Subject {
    readonly modeOf: typeof modeOf
    readonly remoteConnectorOf: typeof remoteConnectorOf
    readonly nativeConnectorOf: typeof nativeConnectorOf
    readonly approvalOf: typeof approvalOf
    readonly constraintsOf: typeof constraintsOf
    readonly constraintsOfJson: typeof constraintsOfJson
    readonly grantOf: typeof grantOf
    readonly grantViewOf: typeof grantViewOf
    readonly callLogViewOf: typeof callLogViewOf
    readonly catalogEntryOf: typeof catalogEntryOf
}

const SUBJECT = Symbol("connector-row.mapper")

/** The mapper functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    modeOf,
                    remoteConnectorOf,
                    nativeConnectorOf,
                    approvalOf,
                    constraintsOf,
                    constraintsOfJson,
                    grantOf,
                    grantViewOf,
                    callLogViewOf,
                    catalogEntryOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const rowOf = builder<McpConnectorRow>({
    key: "hakuen",
    name: "HAKUEN",
    kind: "remote",
    url: "https://hakuen.test/mcp",
    credential_state: "none",
    credential_set_at: null,
    status: "active",
    contract_version: "hakuen-mcp@1",
    timeout_ms: 4000,
    tool_catalog: [],
    catalog_hash: "",
    approved_catalog: [],
    approved_at: null,
    checked_at: null,
})

const logOf = builder<CallLogRecord>({
    id: "l1",
    tool: "hakuen.rates.quote",
    agent_name: "Sales",
    outcome: "ok",
    error_code: null,
    args_masked: "{}",
    result_summary: "{}",
    duration_ms: 12,
    approved_by: null,
    created_at: "2026-10-20",
})

describe("connector-row.mapper remote connectors", () => {
    it("runs the pinned catalog and nothing else, with the row's endpoint, status and bounded limit", async () => {
        const { remoteConnectorOf } = await build()

        expect(remoteConnectorOf(rowOf())).toMatchObject({
            manifest: { key: "hakuen", name: "HAKUEN", kind: "remote", contractVersion: "hakuen-mcp@1", tools: [] },
            status: "active",
            url: "https://hakuen.test/mcp",
            credentialState: "none",
            credentialSetAt: null,
            timeoutMs: 4000,
        })
        expect(remoteConnectorOf(rowOf({ tool_catalog: null, status: "weird" })).status).toBe("disabled")
        expect(
            remoteConnectorOf(rowOf({ credential_state: "set", credential_set_at: "2026-10-22T01:00:00.000Z" })),
        ).toMatchObject({ credentialState: "set", credentialSetAt: "2026-10-22T01:00:00.000Z" })
    })
})

describe("connector-row.mapper remote connectors", () => {
    it("reads scope, role, masked members and the replay key from what each tool declares", async () => {
        const { remoteConnectorOf } = await build()

        const connector = remoteConnectorOf(
            rowOf({
                tool_catalog: [
                    {
                        name: "customer.find",
                        description: "Find a customer.",
                        inputSchema: { type: "object" },
                        annotations: { readOnlyHint: true },
                        meta: { "nivo/role": "identity.find", "nivo/secretFields": ["pin", 3] },
                    },
                    {
                        name: "order.place",
                        inputSchema: { properties: { idempotencyKey: { type: "string" } } },
                        annotations: { readOnlyHint: "yes" },
                        meta: { "nivo/role": "unknown.role" },
                    },
                    {
                        name: "order.note",
                        inputSchema: { properties: 1 },
                        annotations: 1,
                        meta: { "nivo/secretFields": "x" },
                    },
                    { name: "order.raw", inputSchema: null },
                    { name: "" },
                    "junk",
                ],
            }),
        )

        expect(connector.manifest.tools).toEqual([
            {
                name: "customer.find",
                description: "Find a customer.",
                scope: "read",
                inputSchema: { type: "object" },
                defaultMode: "never",
                secretFields: ["pin"],
                role: "identity.find",
            },
            {
                name: "order.place",
                description: "",
                scope: "write",
                inputSchema: { properties: { idempotencyKey: { type: "string" } } },
                defaultMode: "never",
                secretFields: [],
                idempotencyArg: "idempotencyKey",
            },
            {
                name: "order.note",
                description: "",
                scope: "write",
                inputSchema: { properties: 1 },
                defaultMode: "never",
                secretFields: [],
            },
            {
                name: "order.raw",
                description: "",
                scope: "write",
                inputSchema: {},
                defaultMode: "never",
                secretFields: [],
            },
        ])
    })
})

describe("connector-row.mapper remote connectors", () => {
    it("runs a native connector at its row's status and bounded limit, else active at the default", async () => {
        const { nativeConnectorOf } = await build()
        const sepay = mock<NativeAdapter>({ manifest: SEPAY_MANIFEST })
        const nativeRow = rowOf({ key: "sepay", kind: "native", status: "disabled", timeout_ms: 100, checked_at: "t1" })

        expect(nativeConnectorOf([], sepay, 4000)).toEqual({
            manifest: SEPAY_MANIFEST,
            status: "active",
            url: null,
            credentialState: "none",
            credentialSetAt: null,
            timeoutMs: 4000,
            approvedTools: null,
            approvedAt: null,
            checkedAt: null,
        })
        expect(nativeConnectorOf([rowOf({ key: "sepay" })], sepay, 4000).status).toBe("active")
        expect(nativeConnectorOf([nativeRow], sepay, 4000)).toMatchObject({
            status: "disabled",
            timeoutMs: 500,
            checkedAt: "t1",
        })
        expect(
            nativeConnectorOf([rowOf({ key: "sepay", kind: "native", status: "x", timeout_ms: 99_999 })], sepay, 4000),
        ).toMatchObject({
            status: "disabled",
            timeoutMs: 15_000,
        })
    })
})

describe("connector-row.mapper remote connectors", () => {
    it("lets a remote tool run only while its live schema hash is the approved one", async () => {
        const { remoteConnectorOf, approvalOf } = await build()
        const live = [
            { name: "booking.hold", hash: "h1" },
            { name: "booking.confirm", hash: "h2-new" },
            { name: "spa.hold", hash: "h3" },
            { name: "stay.current" },
            "junk",
        ]
        const row = rowOf({
            tool_catalog: live,
            approved_catalog: [
                { name: "booking.hold", hash: "h1" },
                { name: "booking.confirm", hash: "h2" },
                { hash: "x" },
            ],
            approved_at: "2026-10-20T01:00:00.000Z",
            checked_at: "2026-10-20T02:00:00.000Z",
        })

        const connector = remoteConnectorOf(row)

        expect([...(connector.approvedTools ?? [])]).toEqual(["booking.hold"])
        expect(connector).toMatchObject({
            approvedAt: "2026-10-20T01:00:00.000Z",
            checkedAt: "2026-10-20T02:00:00.000Z",
        })
        expect(approvalOf(row)).toEqual([
            { name: "booking.hold", hash: "h1" },
            { name: "booking.confirm", hash: "h2-new" },
            { name: "spa.hold", hash: "h3" },
        ])
        expect([...(remoteConnectorOf(rowOf({ approved_catalog: null })).approvedTools ?? [])]).toEqual([])
    })
})

describe("connector-row.mapper grants", () => {
    it("reads modes, limits and well-formed constraints", async () => {
        const { grantOf, modeOf } = await build()

        expect(modeOf("ask")).toBe("ask")
        expect(modeOf("x")).toBe("never")
        expect(
            grantOf({
                tool: "a.b",
                mode: "auto",
                limit_vnd: "1000",
                constraints: [{ arg: "x" }, { arg: "pct", max: 5 }],
            }),
        ).toEqual({ tool: "a.b", mode: "auto", limitVnd: 1000, constraints: [{ arg: "pct", max: 5 }] })
        expect(grantOf({ tool: "a.b", mode: "ask", limit_vnd: "abc", constraints: null })).toEqual({
            tool: "a.b",
            mode: "ask",
            limitVnd: null,
            constraints: [],
        })
        expect(
            grantOf({ tool: "a.b", mode: "ask", limit_vnd: 7, constraints: [3, { arg: "", max: 1 }] }).limitVnd,
        ).toBe(7)
    })

    it("reads the constraints of a console text; a text that is not a JSON array is refused", async () => {
        const { constraintsOfJson } = await build()

        expect(constraintsOfJson(null)).toEqual([])
        expect(constraintsOfJson(undefined)).toEqual([])
        expect(constraintsOfJson("  ")).toEqual([])
        expect(constraintsOfJson('[{"arg":"discountPct","max":5}]')).toEqual([{ arg: "discountPct", max: 5 }])
        expect(constraintsOfJson('{"arg":"discountPct"}')).toBeNull()
        expect(constraintsOfJson("not json")).toBeNull()
    })

    it("shows a workspace grant with its agent and its constraints as JSON", async () => {
        const { grantViewOf } = await build()

        expect(
            grantViewOf({
                tool: "a.b",
                mode: "ask",
                limit_vnd: null,
                constraints: [{ arg: "discountPct", max: 5 }],
                agent_id: "a",
                agent_name: "Sales",
            }),
        ).toEqual({
            tool: "a.b",
            mode: "ask",
            limitVnd: null,
            constraints: [{ arg: "discountPct", max: 5 }],
            agentId: "a",
            agentName: "Sales",
            constraintsJson: '[{"arg":"discountPct","max":5}]',
        })
    })
})

describe("connector-row.mapper audit and catalog", () => {
    it("reads audit rows with an ISO time and a known outcome", async () => {
        const { callLogViewOf } = await build()

        expect(callLogViewOf(logOf({ created_at: new Date("2026-10-20T00:00:00Z") }))).toEqual({
            id: "l1",
            tool: "hakuen.rates.quote",
            agentName: "Sales",
            outcome: "ok",
            errorCode: null,
            argsMasked: "{}",
            resultSummary: "{}",
            durationMs: 12,
            approvedBy: null,
            at: "2026-10-20T00:00:00.000Z",
        })
        expect(callLogViewOf(logOf({ outcome: "zzz" }))).toMatchObject({ outcome: "error", at: "2026-10-20" })
    })

    it("keeps a remote tool as a plain catalog entry", async () => {
        const { catalogEntryOf } = await build()

        const tool = {
            name: "a",
            description: "b",
            inputSchema: { type: "object" },
            annotations: { readOnlyHint: true },
            meta: { "nivo/role": "invoice.list" },
        }
        expect(catalogEntryOf(tool)).toEqual({
            ...tool,
            hash: argsHashOf(tool),
        })
    })
})
