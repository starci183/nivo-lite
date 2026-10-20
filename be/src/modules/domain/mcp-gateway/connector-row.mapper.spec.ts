import {
    callLogViewOf,
    catalogEntryOf,
    grantOf,
    grantViewOf,
    modeOf,
    nativeStatusOf,
    remoteConnectorOf,
} from "./connector-row.mapper"
import type { ConnectorRow } from "./persistence/mcp-gateway.rows"

const ROW: ConnectorRow = {
    key: "hakuen",
    name: "HAKUEN",
    kind: "remote",
    url: "https://hakuen.test/mcp",
    credential_ref: null,
    status: "active",
    contract_version: "hakuen-mcp@1",
    timeout_ms: 4000,
    tool_catalog: [],
}

describe("connector-row.mapper", () => {
    it("falls back to the known manifest when the catalog is empty", () => {
        const connector = remoteConnectorOf(ROW)
        expect(connector.manifest.tools).toHaveLength(16)
        expect(connector.status).toBe("active")
        expect(remoteConnectorOf({ ...ROW, tool_catalog: null, status: "weird" }).status).toBe("disabled")
    })

    it("merges the live catalog with the known scopes and masks; unknown tools start at never", () => {
        const connector = remoteConnectorOf({
            ...ROW,
            tool_catalog: [
                { name: "keycode.reveal", description: "", inputSchema: { type: "object", required: ["stayId"] } },
                { name: "spa.vip", description: "VIP", inputSchema: null, scope: "read" },
                { name: "rates.quote", inputSchema: 3 },
                { name: "" },
                "junk",
            ],
        })
        expect(connector.manifest.tools).toEqual([
            {
                name: "keycode.reveal",
                description: "The room key code of a checked-in stay.",
                scope: "restricted",
                inputSchema: { type: "object", required: ["stayId"] },
                defaultMode: "never",
                secretFields: ["code", "keyCode"],
            },
            {
                name: "spa.vip",
                description: "VIP",
                scope: "read",
                inputSchema: {},
                defaultMode: "never",
                secretFields: [],
            },
            {
                name: "rates.quote",
                description: "Nightly price, total and cancellation policy of a room type.",
                scope: "read",
                inputSchema: { type: "object" },
                defaultMode: "auto",
                secretFields: [],
            },
        ])
        const unknown = remoteConnectorOf({ ...ROW, key: "zalo-shop", tool_catalog: [{ name: "x.y" }] })
        expect(unknown.manifest.tools[0]).toMatchObject({ scope: "write", defaultMode: "never", description: "" })
        expect(remoteConnectorOf({ ...ROW, key: "zalo-shop" }).manifest.tools).toEqual([])
    })

    it("reads native statuses, modes and grants", () => {
        expect(nativeStatusOf([], "sepay")).toBe("active")
        expect(nativeStatusOf([{ ...ROW, key: "sepay", kind: "native", status: "disabled" }], "sepay")).toBe("disabled")
        expect(nativeStatusOf([{ ...ROW, key: "sepay", kind: "native", status: "x" }], "sepay")).toBe("disabled")
        expect(modeOf("ask")).toBe("ask")
        expect(modeOf("x")).toBe("never")
        expect(
            grantOf({
                tool: "a.b",
                mode: "auto",
                limit_vnd: "1000",
                constraints: [{ arg: "x" }, { arg: "discountPct", max: 5 }],
            }),
        ).toEqual({
            tool: "a.b",
            mode: "auto",
            limitVnd: 1000,
            constraints: [],
        })
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
        })
    })

    it("reads audit rows and catalog entries", () => {
        const base = {
            id: "l1",
            tool: "hakuen.rates.quote",
            agent_name: "Sales",
            outcome: "ok",
            error_code: null,
            args_masked: "{}",
            result_summary: "{}",
            duration_ms: 12,
            approved_by: null,
        }
        expect(callLogViewOf({ ...base, created_at: new Date("2026-10-20T00:00:00Z") }).at).toBe(
            "2026-10-20T00:00:00.000Z",
        )
        expect(callLogViewOf({ ...base, outcome: "zzz", created_at: "2026-10-20" })).toMatchObject({
            outcome: "error",
            at: "2026-10-20",
        })
        expect(catalogEntryOf({ name: "a", description: "b", inputSchema: {} })).toEqual({
            name: "a",
            description: "b",
            inputSchema: {},
        })
    })
})
