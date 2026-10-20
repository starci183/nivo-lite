import { mock, mockEntityManager } from "@starci/jest-preset"
import { McpError, McpErrorCode } from "@modules/integrations/mcp"
import { McpRemoteClient } from "@modules/integrations/mcp"
import { Secret } from "@modules/platform/config"
import type { Logger } from "@modules/platform/logging"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.adapter"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { GatewayCaller, NativeAdapter } from "./mcp-gateway.contracts"
import { McpGatewayService } from "./mcp-gateway.service"
import { AGENTS_GRANTED, INSERT_CALL_LOG, LIST_AGENT_GRANTS, LIST_CONNECTORS } from "./persistence/mcp-gateway.sql"

const CALLER: GatewayCaller = { workspaceId: "ws", agentId: "sales", conversationId: "c1", workItemId: null }
const HAKUEN_ROW = {
    key: "hakuen",
    name: "HAKUEN",
    kind: "remote",
    url: "https://hakuen.test/mcp",
    credential_ref: "MCP_HAKUEN_CLIENT_SECRET",
    status: "active",
    contract_version: "hakuen-mcp@1",
    timeout_ms: 4000,
    tool_catalog: [],
}

interface Setup {
    readonly connectors?: ReadonlyArray<unknown>
    readonly grants?: ReadonlyArray<unknown>
    readonly credentials?: ReadonlyMap<string, Secret>
    readonly native?: NativeAdapter["invoke"]
}

const build = (setup: Setup = {}) => {
    const entityManager = mockEntityManager()
    const answers = new Map<string, unknown>([
        [LIST_CONNECTORS, setup.connectors ?? [HAKUEN_ROW]],
        [
            LIST_AGENT_GRANTS,
            setup.grants ?? [
                { tool: "hakuen.*", mode: "auto", limit_vnd: null, constraints: [{ arg: "discountPct", max: 10 }] },
            ],
        ],
        [INSERT_CALL_LOG, []],
        [AGENTS_GRANTED, [{ agent_id: "a1" }, { agent_id: "a1" }, { agent_id: "a2" }]],
    ])
    entityManager.query.mockImplementation((query: string) => Promise.resolve(answers.get(query)))
    const remote = mock<McpRemoteClient>()
    remote.call.mockResolvedValue({ isError: false, value: { holdId: "h1", code: "777" } })
    const native: NativeAdapter = {
        manifest: SEPAY_MANIFEST,
        invoke: jest.fn(setup.native ?? (() => Promise.resolve({ transactions: [] }))),
    }
    let now = 1_000_000
    const clock = { now: () => new Date((now += 10)) }
    const logger = mock<Logger>()
    const service = new McpGatewayService(
        entityManager,
        {
            credentials: setup.credentials ?? new Map([["MCP_HAKUEN_CLIENT_SECRET", new Secret("bearer-1")]]),
            agentToken: null,
            defaultTimeoutMs: 4000,
        },
        [native],
        clock,
        logger,
        remote,
    )
    const logged = (): ReadonlyArray<ReadonlyArray<unknown>> =>
        entityManager.query.mock.calls.flatMap((call): ReadonlyArray<ReadonlyArray<unknown>> => {
            const params: unknown = call[1]
            return call[0] === INSERT_CALL_LOG && Array.isArray(params) ? [params] : []
        })
    return { service, remote, native, entityManager, logged, logger }
}

describe("McpGatewayService", () => {
    it("lists native connectors (status from their row) and the remote ones", async () => {
        const { service } = build({
            connectors: [HAKUEN_ROW, { ...HAKUEN_ROW, key: "sepay", kind: "native", status: "disabled", url: null }],
        })
        const connectors = await service.connectorsOf("ws")
        expect(connectors.map((entry) => [entry.manifest.key, entry.status])).toEqual([
            ["sepay", "disabled"],
            ["hakuen", "active"],
        ])
        expect(connectors[1]?.manifest.tools.length).toBe(16)
    })

    it("answers the distinct agents granted a tool", async () => {
        await expect(build().service.agentsGranted("ws", ["hakuen.keycode.reveal"])).resolves.toEqual(["a1", "a2"])
    })

    it("calls a granted remote tool with the bearer and audits it masked", async () => {
        const { service, remote, logged } = build()
        await expect(service.call(CALLER, "hakuen.booking.hold", { roomType: "deluxe" })).resolves.toEqual({
            ok: true,
            value: { holdId: "h1", code: "777" },
        })
        expect(remote.call).toHaveBeenCalledWith(
            { url: "https://hakuen.test/mcp", bearer: "bearer-1" },
            "booking.hold",
            { roomType: "deluxe" },
            4000,
        )
        const line = logged()[0] ?? []
        expect(line.slice(0, 6)).toEqual(["ws", "hakuen", "hakuen.booking.hold", "sales", "c1", null])
        expect(line[8]).toBe("ok")
        expect(String(line[10])).toContain('"code":"***"')
    })

    it("calls a remote server without a credential", async () => {
        const { service, remote } = build({ connectors: [{ ...HAKUEN_ROW, credential_ref: null }] })
        await service.call(CALLER, "hakuen.rates.quote", {})
        expect(remote.call.mock.calls[0]?.[0]).toEqual({ url: "https://hakuen.test/mcp", bearer: null })
        const bare = build({ connectors: [{ ...HAKUEN_ROW, url: null }] })
        await bare.service.call(CALLER, "hakuen.rates.quote", {})
        expect(bare.remote.call.mock.calls[0]?.[0]).toEqual({ url: "", bearer: "bearer-1" })
        const open = build({ connectors: [{ ...HAKUEN_ROW, url: null, credential_ref: null }] })
        await open.service.call(CALLER, "hakuen.rates.quote", {})
        expect(open.remote.call.mock.calls[0]?.[0]).toEqual({ url: "", bearer: null })
    })

    it("refuses names, unknown tools and disabled connectors before any grant", async () => {
        const disabled = build({ connectors: [{ ...HAKUEN_ROW, status: "disabled" }] })
        await expect(disabled.service.call(CALLER, "hakuen.rates.quote", {})).resolves.toEqual({
            ok: false,
            code: "connector_disabled",
            detail: "hakuen",
        })
        const { service, logged } = build()
        await expect(service.call(CALLER, "nope", {})).resolves.toMatchObject({ code: "invalid_name" })
        await expect(service.call(CALLER, "hakuen.rooms.teleport", {})).resolves.toMatchObject({ code: "unknown_tool" })
        await expect(service.call(CALLER, "other.rooms.list", {})).resolves.toMatchObject({ code: "unknown_tool" })
        expect(logged()).toEqual([])
    })

    it("denies an ungranted tool and audits the refusal", async () => {
        const { service, remote, logged } = build({ grants: [] })
        await expect(service.call(CALLER, "hakuen.rates.quote", { roomType: "deluxe" })).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "hakuen.rates.quote",
        })
        await expect(service.call(CALLER, "hakuen.keycode.reveal", { stayId: "s1" })).resolves.toEqual({
            ok: false,
            code: "approval_required",
            reason: "no_rule",
        })
        expect(remote.call).not.toHaveBeenCalled()
        expect(logged().map((line) => line[8])).toEqual(["refused", "approval"])
    })

    it("holds a discount over limit_pct for approval, and runs the approved replay", async () => {
        const { service, remote, logged } = build()
        await expect(
            service.call(CALLER, "hakuen.booking.confirm", { holdId: "h1", discountPct: 15 }),
        ).resolves.toEqual({
            ok: false,
            code: "approval_required",
            reason: "price_exception",
        })
        expect(remote.call).not.toHaveBeenCalled()
        await expect(
            service.call({ ...CALLER, approvedBy: "Quản lý" }, "hakuen.booking.confirm", {
                holdId: "h1",
                discountPct: 15,
            }),
        ).resolves.toMatchObject({ ok: true })
        expect(logged().map((line) => [line[8], line[12]])).toEqual([
            ["approval", null],
            ["ok", "Quản lý"],
        ])
    })

    it("answers a tool error as tool_error", async () => {
        const { service, remote, logged } = build()
        remote.call.mockResolvedValueOnce({ isError: true, value: { text: "stay not checked in" } })
        await expect(service.call(CALLER, "hakuen.stay.checkIn", {})).resolves.toMatchObject({
            ok: false,
            code: "tool_error",
        })
        expect(logged()[0]?.[8]).toBe("error")
    })

    it("answers unavailable on timeout and on failure, and opens the breaker after five", async () => {
        const { service, remote, logged, logger } = build()
        remote.call.mockRejectedValueOnce(new McpError({ code: McpErrorCode.Timeout }))
        await expect(service.call(CALLER, "hakuen.rates.quote", {})).resolves.toEqual({
            ok: false,
            code: "unavailable",
            detail: "MCP_TIMEOUT",
        })
        remote.call.mockRejectedValue(new Error("boom"))
        for (let attempt = 0; attempt < 4; attempt += 1) await service.call(CALLER, "hakuen.rates.quote", {})
        await expect(service.call(CALLER, "hakuen.rates.quote", {})).resolves.toEqual({
            ok: false,
            code: "unavailable",
            detail: "circuit_open",
        })
        expect(logged().map((line) => line[8])).toEqual(["timeout", "error", "error", "error", "error", "circuit_open"])
        expect(logged()[1]?.[9]).toBe("internal")
        expect(logger.error).toHaveBeenCalled()
    })

    it("answers unavailable when the named credential is missing", async () => {
        const { service } = build({ credentials: new Map() })
        await expect(service.call(CALLER, "hakuen.rates.quote", {})).resolves.toEqual({
            ok: false,
            code: "unavailable",
            detail: McpGatewayErrorCode.CredentialMissing,
        })
    })

    it("runs a native adapter under the time limit", async () => {
        const grants = [{ tool: "sepay.transactions.list", mode: "auto", limit_vnd: null, constraints: [] }]
        const { service, native } = build({ grants })
        await expect(service.call(CALLER, "sepay.transactions.list", { limit: 5 })).resolves.toEqual({
            ok: true,
            value: { transactions: [] },
        })
        expect(native.invoke).toHaveBeenCalledWith("ws", "transactions.list", { limit: 5 })
        jest.useFakeTimers()
        try {
            const slow = build({ grants, native: () => new Promise(() => undefined) })
            const pending = slow.service.call(CALLER, "sepay.transactions.list", {})
            await jest.advanceTimersByTimeAsync(4000)
            await expect(pending).resolves.toEqual({
                ok: false,
                code: "unavailable",
                detail: McpGatewayErrorCode.Timeout,
            })
            expect(slow.logged()[0]?.[8]).toBe("timeout")
        } finally {
            jest.useRealTimers()
        }
    })

    it("fails a native connector whose adapter is gone", async () => {
        const { service } = build({ grants: [{ tool: "sepay.*", mode: "auto", limit_vnd: null, constraints: [] }] })
        const natives: Array<NativeAdapter> = Reflect.get(service, "natives")
        natives.splice(0)
        await expect(service.call(CALLER, "sepay.transactions.list", {})).resolves.toMatchObject({
            code: "unknown_tool",
        })
        const resolved = { manifest: SEPAY_MANIFEST, status: "active", url: null, credentialRef: null, timeoutMs: 10 }
        const native: (ws: string, c: unknown, t: string, a: object) => Promise<unknown> = Reflect.get(
            service,
            "native",
        ).bind(service)
        await expect(native("ws", resolved, "transactions.list", {})).rejects.toEqual(
            new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool: "transactions.list" } }),
        )
    })

    it("searches and describes only granted tools", async () => {
        const { service } = build({
            grants: [
                { tool: "hakuen.*", mode: "auto", limit_vnd: "500", constraints: [{ arg: "discountPct", max: 10 }] },
                { tool: "hakuen.keycode.reveal", mode: "never", limit_vnd: null, constraints: [] },
            ],
            connectors: [HAKUEN_ROW, { ...HAKUEN_ROW, key: "sepay", kind: "native", status: "disabled" }],
        })
        const found = await service.search(CALLER, "booking hold", 5)
        expect(found[0]?.name).toBe("hakuen.booking.hold")
        expect(found.some((tool) => tool.name.startsWith("sepay."))).toBe(false)
        await expect(service.describe(CALLER, "hakuen.booking.confirm")).resolves.toMatchObject({
            name: "hakuen.booking.confirm",
            mode: "auto",
            constraints: [{ arg: "discountPct", max: 10 }],
            limitVnd: 500,
        })
        await expect(service.describe(CALLER, "hakuen.keycode.reveal")).resolves.toBeNull()
        await expect(service.describe(CALLER, "hakuen.nope")).resolves.toBeNull()
        await expect(service.describe(CALLER, "sepay.transactions.list")).resolves.toBeNull()
    })
})
