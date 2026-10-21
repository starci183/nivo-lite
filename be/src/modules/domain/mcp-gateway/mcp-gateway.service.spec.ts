import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { McpCallLogService } from "@modules/domain/mcp-call-log"
import type { CallLogLine } from "@modules/domain/mcp-call-log"
import { McpConnectorsService } from "@modules/domain/mcp-connectors"
import { McpToolGrantsService } from "@modules/domain/mcp-tool-grants"
import { MCP_REMOTE, McpError, McpErrorCode } from "@modules/integrations/mcp"
import type { McpRemote, McpRemoteResult } from "@modules/integrations/mcp"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_TIMEOUT } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.service"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { GatewayCaller, NativeAdapter } from "./mcp-gateway.contracts"
import { MCP_GATEWAY_OPTIONS, NATIVE_ADAPTERS } from "./mcp-gateway.decorators"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"
import { McpGatewayService } from "./mcp-gateway.service"
import {
    catalogToolOf as toolOf,
    GATEWAY_CALLER as CALLER,
    GATEWAY_CATALOG as CATALOG,
    roleProvidersOf,
    answerOf,
    refusalOf,
    refusedReadLineOf,
    remoteConnectorRowOf as connectorOf,
    toolGrantRowOf as grantOf,
} from "@tests/fixtures/builders/mcp-gateway.builder"
import type { GatewaySpecSetup } from "@tests/fixtures/builders/mcp-gateway.builder"

const build = async (setup: GatewaySpecSetup = {}) => {
    const clock = new FakeClock("2026-10-20T02:00:00.000Z")
    const logger = mock<Logger>()
    const remote = mock<McpRemote>()
    remote.call.mockResolvedValue({ isError: false, value: { holdId: "h1", code: "777" } })
    const native = mock<NativeAdapter>({ manifest: SEPAY_MANIFEST })
    native.invoke.mockResolvedValue({ transactions: [] })
    const cancel = jest.fn()
    const timeout = mock<QueueTimeout>()
    timeout.schedule.mockReturnValue(cancel)
    const connectors = mock<McpConnectorsService>()
    connectors.list.mockResolvedValue(setup.rows ?? [connectorOf()])
    const grants = mock<McpToolGrantsService>()
    grants.listOfAgent.mockResolvedValue(setup.grants ?? [grantOf()])
    grants.agentsGranted.mockResolvedValue(["a1", "a2"])
    const callLog = mock<McpCallLogService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpGatewayService,
            {
                provide: MCP_GATEWAY_OPTIONS,
                useValue: { remote: { credentials: new Map() }, defaultTimeoutMs: setup.timeoutMs ?? 4000 },
            },
            { provide: NATIVE_ADAPTERS, useValue: [native] },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: MCP_REMOTE, useValue: remote },
            { provide: QUEUE_TIMEOUT, useValue: timeout },
            { provide: McpConnectorsService, useValue: connectors },
            { provide: McpToolGrantsService, useValue: grants },
            { provide: McpCallLogService, useValue: callLog },
        ],
    }).compile()
    const gateway = moduleRef.get(McpGatewayService)
    return { gateway, clock, logger, remote, native, timeout, cancel, connectors, grants, callLog }
}

/** The audit lines written, in order. */
const linesOf = (callLog: ReturnType<typeof mock<McpCallLogService>>): ReadonlyArray<CallLogLine> =>
    callLog.append.mock.calls.map(([line]) => line)

describe("McpGatewayService registry and discovery", () => {
    it("lists every native connector with its row's status and bounded time limit, and the remote rows", async () => {
        const nativeRow = connectorOf({ key: "sepay", kind: "native", status: "disabled", timeout_ms: 99_999 })
        const { gateway } = await build({ rows: [connectorOf({ timeout_ms: 10 }), nativeRow] })

        const connectors = await gateway.connectorsOf("ws-1")

        expect(connectors.map((connector) => [connector.manifest.key, connector.status, connector.timeoutMs])).toEqual([
            ["sepay", "disabled", 15_000],
            ["hakuen", "active", 500],
        ])
        expect(connectors[0]?.approvedTools).toBeNull()
        expect(connectors[1]?.approvedTools?.size).toBe(CATALOG.length)
    })

    it("answers the grants of an agent and the agents granted a tool", async () => {
        const { gateway, grants } = await build()

        await expect(gateway.grantsOf("ws-1", "sales")).resolves.toEqual([
            { tool: "hakuen.*", mode: "auto", limitVnd: null, constraints: [{ arg: "discountPct", max: 10 }] },
        ])
        await expect(gateway.agentsGranted("ws-1", ["sepay.*"])).resolves.toEqual(["a1", "a2"])
        expect(grants.listOfAgent).toHaveBeenCalledWith("ws-1", "sales")
        expect(grants.agentsGranted).toHaveBeenCalledWith("ws-1", ["sepay.*"])
    })

    it("searches only the approved, granted tools of the connectors that are not disabled", async () => {
        const disabled = connectorOf({ key: "sepay", kind: "native", status: "disabled" })
        const unapproved = connectorOf({
            approved_catalog: CATALOG.filter((tool) => tool.name !== "spa.findSlots").map(({ name, hash }) => ({
                name,
                hash,
            })),
        })
        const { gateway } = await build({
            rows: [unapproved, disabled],
            grants: [grantOf(), grantOf({ tool: "sepay.*" })],
        })

        const found = await gateway.search(CALLER, "spa slots", 3)

        expect(found.map((tool) => tool.name)).not.toContain("hakuen.spa.findSlots")
        expect(found.every((tool) => tool.name.startsWith("hakuen."))).toBe(true)
        expect(found[0]?.name).toBe("hakuen.spa.hold")
    })

    it("describes an approved granted tool with the caller's limits, and nothing else", async () => {
        const changed = connectorOf({
            tool_catalog: CATALOG.map((tool) => (tool.name === "stay.current" ? { ...tool, hash: "hash-new" } : tool)),
        })
        const { gateway } = await build({
            rows: [changed],
            grants: [grantOf(), grantOf({ tool: "hakuen.keycode.reveal", mode: "never" })],
        })

        await expect(gateway.describe(CALLER, "hakuen.booking.confirm")).resolves.toEqual({
            name: "hakuen.booking.confirm",
            description: "Confirm a held booking.",
            scope: "write",
            mode: "auto",
            inputSchema: { type: "object" },
            constraints: [{ arg: "discountPct", max: 10 }],
            limitVnd: null,
        })
        await expect(gateway.describe(CALLER, "hakuen.stay.current")).resolves.toBeNull()
        await expect(gateway.describe(CALLER, "hakuen.keycode.reveal")).resolves.toBeNull()
        await expect(gateway.describe(CALLER, "sepay.transactions.list")).resolves.toBeNull()
        await expect(gateway.describe(CALLER, "nope")).resolves.toBeNull()
    })
})

describe("McpGatewayService.toolForRole", () => {
    it("finds the approved tool that declares a role, natives first, and answers no_capability otherwise", async () => {
        const { gateway } = await build({
            rows: [connectorOf(), connectorOf({ key: "shop", approved_catalog: [] })],
        })

        await expect(gateway.toolForRole("ws-1", "payment.credits.list")).resolves.toEqual({
            ok: true,
            tool: {
                role: "payment.credits.list",
                name: "sepay.transactions.list",
                connector: "sepay",
                connectorName: "SePay",
            },
        })
        await expect(gateway.toolForRole("ws-1", "identity.find")).resolves.toEqual({
            ok: true,
            tool: {
                role: "identity.find",
                name: "hakuen.guest.findByChannelIdentity",
                connector: "hakuen",
                connectorName: "HAKUEN",
            },
        })
        await expect(gateway.toolForRole("ws-1", "receivable.find")).resolves.toEqual({
            ok: false,
            code: "no_capability",
            role: "receivable.find",
        })
    })

    it("skips a disabled connector and a tool whose schema is not approved", async () => {
        const unapproved = connectorOf({ approved_catalog: [] })
        const disabled = connectorOf({ key: "sepay", kind: "native", status: "disabled" })
        const { gateway } = await build({ rows: [unapproved, disabled] })

        await expect(gateway.toolForRole("ws-1", "identity.find")).resolves.toMatchObject({ code: "no_capability" })
        await expect(gateway.toolForRole("ws-1", "payment.credits.list")).resolves.toMatchObject({
            code: "no_capability",
        })
    })
})

describe("McpGatewayService.readiness", () => {
    it("is ready when every asked role has a usable tool, and lists the providers of every role", async () => {
        const payer = connectorOf({
            key: "pay",
            name: "Pay Gateway",
            status: "disabled",
            tool_catalog: [
                toolOf("receivable.lookup", "Find a receivable.", true, { meta: { "nivo/role": "receivable.find" } }),
            ],
        })
        const { gateway } = await build({ rows: [connectorOf(), payer] })

        await expect(gateway.readiness("ws-1", ["payment.credits.list", "identity.find"])).resolves.toEqual({
            ready: true,
            missing: [],
            providers: roleProvidersOf({
                "identity.find": ["HAKUEN"],
                "receivable.find": ["Pay Gateway"],
                "payment.credits.list": ["SePay"],
                "payment.debits.list": ["SePay"],
            }),
        })
        await expect(gateway.readiness("ws-1", ["payment.credits.list", "receivable.find"])).resolves.toMatchObject({
            ready: false,
            missing: ["receivable.find"],
        })
        await expect(gateway.readiness("ws-1", [])).resolves.toMatchObject({ ready: true, missing: [] })
    })
})

describe("McpGatewayService.call refusals", () => {
    it("stops a bad name, an unknown tool or a disabled connector before any grant, without an audit line", async () => {
        const disabled = connectorOf({ key: "sepay", kind: "native", status: "disabled" })
        const { gateway, grants, callLog } = await build({ rows: [connectorOf(), disabled] })

        await expect(gateway.call(CALLER, "nope", {})).resolves.toEqual(refusalOf("invalid_name", "nope"))
        await expect(gateway.call(CALLER, "zalo.send", {})).resolves.toEqual(refusalOf("unknown_tool", "zalo.send"))
        await expect(gateway.call(CALLER, "hakuen.nope", {})).resolves.toMatchObject({ code: "unknown_tool" })
        await expect(gateway.call(CALLER, "sepay.transactions.list", {})).resolves.toEqual(
            refusalOf("connector_disabled", "sepay"),
        )
        expect(grants.listOfAgent).not.toHaveBeenCalled()
        expect(callLog.append).not.toHaveBeenCalled()
    })

    it("refuses a remote tool whose live schema is not the approved one, and audits it", async () => {
        const changed = connectorOf({
            tool_catalog: CATALOG.map((tool) => (tool.name === "booking.hold" ? { ...tool, hash: "hash-new" } : tool)),
        })
        const { gateway, remote, callLog } = await build({
            rows: [changed, connectorOf({ key: "shop", approved_catalog: [] })],
        })

        await expect(gateway.call(CALLER, "hakuen.booking.hold", { roomType: "deluxe" })).resolves.toEqual(
            refusalOf("schema_unapproved", "hakuen.booking.hold"),
        )
        await expect(gateway.call(CALLER, "shop.stay.current", {})).resolves.toMatchObject({
            code: "schema_unapproved",
        })
        expect(remote.call).not.toHaveBeenCalled()
        expect(linesOf(callLog).map((line) => [line.tool, line.outcome, line.errorCode])).toEqual([
            ["hakuen.booking.hold", "refused", "schema_unapproved"],
            ["shop.stay.current", "refused", "schema_unapproved"],
        ])
    })

    it("refuses a read the agent is not granted and audits it", async () => {
        const { gateway, callLog, native } = await build()

        await expect(gateway.call(CALLER, "sepay.transactions.list", { limit: 5 })).resolves.toEqual(
            refusalOf("not_granted", "sepay.transactions.list"),
        )
        expect(native.invoke).not.toHaveBeenCalled()
        expect(linesOf(callLog)).toEqual([refusedReadLineOf()])
    })

    it("asks a person in ask mode or over a constraint, and audits the approval", async () => {
        const { gateway, callLog, remote } = await build({
            grants: [grantOf(), grantOf({ tool: "hakuen.booking.cancel", mode: "ask", constraints: [] })],
        })

        await expect(gateway.call(CALLER, "hakuen.booking.cancel", { bookingId: "b1" })).resolves.toEqual({
            ok: false,
            code: "approval_required",
            reason: "ask_mode",
        })
        await expect(
            gateway.call(CALLER, "hakuen.booking.confirm", { holdId: "h1", discountPct: 15 }),
        ).resolves.toEqual({ ok: false, code: "approval_required", reason: "over_constraint" })
        expect(remote.call).not.toHaveBeenCalled()
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual([
            ["approval", "ask_mode"],
            ["approval", "over_constraint"],
        ])
    })
})

describe("McpGatewayService.call remote connectors", () => {
    it("calls the remote tool with its credential name, masks the audit and answers the result", async () => {
        const { gateway, remote, callLog } = await build()

        await expect(gateway.call(CALLER, "hakuen.keycode.reveal", { stayId: "s1" })).resolves.toEqual(
            answerOf({ holdId: "h1", code: "777" }),
        )
        expect(remote.call).toHaveBeenCalledWith({
            endpoint: { url: "https://hakuen.test/mcp", credentialRef: "MCP_HAKUEN_CLIENT_SECRET" },
            name: "keycode.reveal",
            args: { stayId: "s1" },
            timeoutMs: 4000,
        })
        expect(linesOf(callLog)[0]).toMatchObject({
            outcome: "ok",
            errorCode: null,
            resultSummary: '{"holdId":"h1","code":"***"}',
        })
    })

    it("sends the same replay key for every run of the same step, and another for another step", async () => {
        const { gateway, remote } = await build()
        const step: GatewayCaller = { ...CALLER, workItemId: "item-1" }
        const hold = { roomType: "deluxe", checkIn: "2026-10-24", nights: 2, guests: 2, guestId: "g1" }

        await gateway.call(step, "hakuen.booking.hold", hold)
        await gateway.call(step, "hakuen.booking.hold", hold)
        await gateway.call({ ...step, opKey: "item-1:rehold" }, "hakuen.booking.hold", hold)
        await gateway.call(step, "hakuen.booking.hold", { ...hold, idempotencyKey: "mine" })
        await gateway.call(CALLER, "hakuen.booking.hold", hold)

        const keys = remote.call.mock.calls.map(([request]) => request.args.idempotencyKey)
        expect(keys[0]).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(keys[1]).toBe(keys[0])
        expect(keys[2]).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(keys[2]).not.toBe(keys[0])
        expect(keys.slice(3)).toEqual(["mine", undefined])
    })

    it("answers a tool refusal as tool_error with the masked summary", async () => {
        const { gateway, remote, callLog } = await build()
        remote.call.mockResolvedValue({ isError: true, value: { error: { code: "NO_AVAILABILITY" } } })

        await expect(gateway.call(CALLER, "hakuen.rooms.searchAvailability", {})).resolves.toEqual(
            refusalOf("tool_error", '{"error":{"code":"***"}}'),
        )
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "error", errorCode: "tool_error" })
    })
})

describe("McpGatewayService.call remote connectors", () => {
    it("answers unavailable on a timeout or a failure, logs it, and reaches a server without a URL as empty", async () => {
        const { gateway, remote, callLog, logger } = await build({ rows: [connectorOf({ url: null })] })
        const timeout = new McpError({ code: McpErrorCode.Timeout, params: { url: "" } })
        remote.call.mockRejectedValueOnce(timeout).mockRejectedValueOnce(new Error("boom"))

        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(
            refusalOf("unavailable", McpErrorCode.Timeout),
        )
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(
            refusalOf("unavailable", "internal"),
        )
        expect(remote.call.mock.calls[0]?.[0].endpoint.url).toBe("")
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual([
            ["timeout", McpErrorCode.Timeout],
            ["error", "internal"],
        ])
        expect(logger.error).toHaveBeenCalledWith(McpGatewayLogEvent.CallFailed, timeout, {
            workspaceId: "ws-1",
            connector: "hakuen",
            tool: "stay.current",
        })
    })

    it("runs an approved replay of a side-effect with no rule and records who approved it", async () => {
        const { gateway, callLog } = await build({ grants: [] })

        await expect(
            gateway.call({ ...CALLER, approvedBy: "manager-1" }, "hakuen.booking.cancel", { bookingId: "b1" }),
        ).resolves.toMatchObject({ ok: true })
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "ok", approvedBy: "manager-1" })
    })
})

describe("McpGatewayService.call writes that time out", () => {
    const timeout = () => new McpError({ code: McpErrorCode.Timeout, params: { url: "" } })

    it("sends a write with its replay key once more and answers what the server stored", async () => {
        const { gateway, remote, callLog } = await build()
        remote.call.mockRejectedValueOnce(timeout()).mockResolvedValueOnce({ isError: false, value: { holdId: "h1" } })
        const step: GatewayCaller = { ...CALLER, workItemId: "item-1" }

        await expect(gateway.call(step, "hakuen.booking.hold", { roomType: "deluxe" })).resolves.toEqual(
            answerOf({ holdId: "h1" }),
        )
        const [first, second] = remote.call.mock.calls.map(([request]) => request.args)
        expect(second).toEqual(first)
        expect(first?.idempotencyKey).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(linesOf(callLog).map((line) => line.outcome)).toEqual(["ok"])
    })

    it("answers unknown_outcome when the replay times out too, or the write has no replay key", async () => {
        const { gateway, remote, callLog } = await build()
        remote.call.mockRejectedValue(timeout())

        await expect(
            gateway.call({ ...CALLER, workItemId: "item-1" }, "hakuen.booking.hold", { roomType: "deluxe" }),
        ).resolves.toEqual({ ok: false, code: "unknown_outcome", detail: McpErrorCode.Timeout })
        await expect(gateway.call(CALLER, "hakuen.booking.hold", { roomType: "deluxe" })).resolves.toMatchObject({
            code: "unknown_outcome",
        })
        await expect(gateway.call(CALLER, "hakuen.booking.confirm", { holdId: "h1" })).resolves.toMatchObject({
            code: "unknown_outcome",
        })
        expect(remote.call).toHaveBeenCalledTimes(4)
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual([
            ["timeout", "unknown_outcome"],
            ["timeout", "unknown_outcome"],
            ["timeout", "unknown_outcome"],
        ])
    })

    it("does not send a failed write again when it did not time out", async () => {
        const { gateway, remote } = await build()
        remote.call.mockRejectedValue(new Error("refused"))

        await expect(
            gateway.call({ ...CALLER, workItemId: "item-1" }, "hakuen.booking.hold", { roomType: "deluxe" }),
        ).resolves.toEqual({ ok: false, code: "unavailable", detail: "internal" })
        expect(remote.call).toHaveBeenCalledTimes(1)
    })
})

describe("McpGatewayService breaker", () => {
    it("opens after five failures of a connector, refuses it meanwhile and audits it, while another connector runs", async () => {
        const { gateway, remote, native, callLog } = await build({ grants: [grantOf(), grantOf({ tool: "sepay.*" })] })
        remote.call.mockRejectedValue(new Error("down"))
        for (let attempt = 0; attempt < 5; attempt += 1) await gateway.call(CALLER, "hakuen.stay.current", {})

        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(
            refusalOf("unavailable", "circuit_open"),
        )
        await expect(gateway.call(CALLER, "sepay.transactions.list", {})).resolves.toMatchObject({ ok: true })
        await expect(
            gateway.call({ ...CALLER, workspaceId: "ws-2" }, "hakuen.stay.current", {}),
        ).resolves.toMatchObject({ detail: "internal" })
        expect(remote.call).toHaveBeenCalledTimes(6)
        expect(native.invoke).toHaveBeenCalledTimes(1)
        expect(linesOf(callLog)[5]).toMatchObject({ outcome: "circuit_open", errorCode: "unavailable" })
    })

    it("lets one probe through after the pause, refuses the others while it runs, and closes when it succeeds", async () => {
        const { gateway, remote, clock } = await build()
        remote.call.mockRejectedValue(new Error("down"))
        for (let attempt = 0; attempt < 5; attempt += 1) await gateway.call(CALLER, "hakuen.stay.current", {})
        clock.advance(120_000)
        const answers: Array<(result: McpRemoteResult) => void> = []
        remote.call.mockReturnValueOnce(
            new Promise((resolve) => {
                answers.push(resolve)
            }),
        )

        const probe = gateway.call(CALLER, "hakuen.stay.current", {})
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toMatchObject({
            detail: "circuit_open",
        })
        for (const answer of answers) answer({ isError: false, value: { stay: null } })
        await expect(probe).resolves.toEqual({ ok: true, value: { stay: null } })

        remote.call.mockResolvedValue({ isError: false, value: { stay: null } })
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toMatchObject({ ok: true })
    })
})

describe("McpGatewayService.call native connectors", () => {
    it("runs the native adapter under the connector's time limit and releases the deadline", async () => {
        const { gateway, native, remote, timeout, cancel } = await build({ grants: [grantOf({ tool: "sepay.*" })] })

        await expect(gateway.call(CALLER, "sepay.transactions.list", { limit: 5 })).resolves.toEqual(
            answerOf({ transactions: [] }),
        )
        expect(native.invoke).toHaveBeenCalledWith("ws-1", "transactions.list", { limit: 5 })
        expect(timeout.schedule.mock.calls[0]?.[1]).toBe(4000)
        expect(cancel).toHaveBeenCalledTimes(1)
        expect(remote.call).not.toHaveBeenCalled()
    })

    it("answers unavailable with the adapter's code when it refuses", async () => {
        const { gateway, native } = await build({ grants: [grantOf({ tool: "sepay.*" })] })
        native.invoke.mockRejectedValue(
            new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool: "transactions.list" } }),
        )

        await expect(gateway.call(CALLER, "sepay.transactions.list", {})).resolves.toEqual(
            refusalOf("unavailable", McpGatewayErrorCode.UnknownTool),
        )
    })

    it("answers timeout when the adapter outlasts the connector's time limit", async () => {
        const { gateway, native, callLog, timeout, cancel } = await build({ grants: [grantOf({ tool: "sepay.*" })] })
        native.invoke.mockReturnValue(new Promise(() => undefined))
        timeout.schedule.mockImplementation((expire) => {
            expire()
            return cancel
        })

        await expect(gateway.call(CALLER, "sepay.transactions.list", {})).resolves.toEqual(
            refusalOf("unavailable", McpGatewayErrorCode.Timeout),
        )
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "timeout", errorCode: McpGatewayErrorCode.Timeout })
        expect(cancel).toHaveBeenCalledTimes(1)
    })
})
