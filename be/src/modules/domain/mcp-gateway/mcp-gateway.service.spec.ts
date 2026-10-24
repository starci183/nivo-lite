import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { McpCallLogService } from "@modules/domain/mcp-call-log"
import { McpConnectorsService } from "@modules/domain/mcp-connectors"
import { GatewayReceiptsService } from "@modules/domain/mcp-gateway-receipts"
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
import type { GatewayCaller, GatewayConnectorManifest, NativeAdapter } from "./mcp-gateway.contracts"
import { MCP_GATEWAY_OPTIONS, NATIVE_ADAPTERS } from "./mcp-gateway.decorators"
import { McpConnectorCredentialService } from "./mcp-connector-credential.service"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"
import { McpGatewayService } from "./mcp-gateway.service"
import {
    GATEWAY_CALLER as CALLER,
    GATEWAY_CATALOG as CATALOG,
    answerOf,
    openedEndpointOf,
    refusalOf,
    refusedReadLineOf,
    remoteConnectorRowOf as connectorOf,
    toolGrantRowOf as grantOf,
} from "@tests/fixtures/builders/mcp-gateway.builder"
import type { GatewaySpecSetup } from "@tests/fixtures/builders/mcp-gateway.builder"
import {
    arrangeGatewayScenario,
    gatewayScenarioOf,
    gatewayLinesOf as linesOf,
    GATEWAY_SCENARIO_EXPECTED as EXPECTED,
    MISSING_WRITE_IDENTITIES,
    REPLAY_SCHEMA_CHANGES,
    reroutedCallerOf,
    TIMED_OUT_WRITES,
    VALID_WRITE_IDENTITIES,
} from "@tests/fixtures/builders/mcp-gateway-scenario.builder"

const WRITE_NATIVE_MANIFEST: GatewayConnectorManifest = {
    ...SEPAY_MANIFEST,
    tools: SEPAY_MANIFEST.tools.map((tool) => ({ ...tool, scope: "write" as const })),
}

const build = async (setup: GatewaySpecSetup = {}, manifest = SEPAY_MANIFEST) => {
    const clock = new FakeClock("2026-10-20T02:00:00.000Z")
    const logger = mock<Logger>()
    const remote = mock<McpRemote>()
    const native = mock<NativeAdapter>({ manifest })
    native.invoke.mockResolvedValue({ transactions: [] })
    const timeout = mock<QueueTimeout>()
    const connectors = mock<McpConnectorsService>()
    const grants = mock<McpToolGrantsService>()
    const callLog = mock<McpCallLogService>()
    const credentials = mock<McpConnectorCredentialService>({ endpointOf: openedEndpointOf })
    const receipts = mock<GatewayReceiptsService>()
    const cancel = jest.fn()
    arrangeGatewayScenario(setup, { remote, timeout, cancel, connectors, grants, receipts })
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpGatewayService,
            { provide: MCP_GATEWAY_OPTIONS, useValue: { defaultTimeoutMs: setup.timeoutMs ?? 4000 } },
            { provide: NATIVE_ADAPTERS, useValue: [native] },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: MCP_REMOTE, useValue: remote },
            { provide: QUEUE_TIMEOUT, useValue: timeout },
            { provide: McpConnectorsService, useValue: connectors },
            { provide: McpToolGrantsService, useValue: grants },
            { provide: McpCallLogService, useValue: callLog },
            { provide: McpConnectorCredentialService, useValue: credentials },
            { provide: GatewayReceiptsService, useValue: receipts },
        ],
    }).compile()
    const gateway = moduleRef.get(McpGatewayService)
    return { gateway, clock, logger, remote, native, timeout, cancel, connectors, grants, callLog, receipts }
}

describe("McpGatewayService registry and discovery", () => {
    it("lists every native connector with its row's status and bounded time limit, and the remote rows", async () => {
        const { gateway } = await build(gatewayScenarioOf("registry"))

        const connectors = await gateway.connectorsOf("ws-1")

        expect(connectors.map((connector) => [connector.manifest.key, connector.status, connector.timeoutMs])).toEqual(
            EXPECTED.connectorStates,
        )
        expect(connectors[0]?.approvedTools).toBeNull()
        expect(connectors[1]?.approvedTools?.size).toBe(CATALOG.length)
    })

    it("answers the grants of an agent and the agents granted a tool", async () => {
        const { gateway, grants } = await build()

        await expect(gateway.grantsOf("ws-1", "sales")).resolves.toEqual(EXPECTED.grants)
        await expect(gateway.agentsGranted("ws-1", ["sepay.*"])).resolves.toEqual(["a1", "a2"])
        expect(grants.listOfAgent).toHaveBeenCalledWith("ws-1", "sales")
        expect(grants.agentsGranted).toHaveBeenCalledWith("ws-1", ["sepay.*"])
    })

    it("searches only the approved, granted tools of the connectors that are not disabled", async () => {
        const { gateway } = await build(gatewayScenarioOf("discovery"))

        const found = await gateway.search(CALLER, "spa slots", 3)

        expect(found.map((tool) => tool.name)).not.toContain("hakuen.spa.findSlots")
        expect(found.every((tool) => tool.name.startsWith("hakuen."))).toBe(true)
        expect(found[0]?.name).toBe("hakuen.spa.hold")
    })

    it("describes an approved granted tool with the caller's limits, and nothing else", async () => {
        const { gateway } = await build(gatewayScenarioOf("description"))

        await expect(gateway.describe(CALLER, "hakuen.booking.confirm")).resolves.toEqual(EXPECTED.confirmation)
        await expect(gateway.describe(CALLER, "hakuen.stay.current")).resolves.toBeNull()
        await expect(gateway.describe(CALLER, "hakuen.keycode.reveal")).resolves.toBeNull()
        await expect(gateway.describe(CALLER, "sepay.transactions.list")).resolves.toBeNull()
        await expect(gateway.describe(CALLER, "nope")).resolves.toBeNull()
    })
})

describe("McpGatewayService.toolForRole", () => {
    it("finds the approved tool that declares a role, natives first, and answers no_capability otherwise", async () => {
        const { gateway } = await build(gatewayScenarioOf("roles"))

        await expect(gateway.toolForRole("ws-1", "payment.credits.list")).resolves.toEqual(EXPECTED.creditsRole)
        await expect(gateway.toolForRole("ws-1", "identity.find")).resolves.toEqual(EXPECTED.identityRole)
        await expect(gateway.toolForRole("ws-1", "receivable.find")).resolves.toEqual(EXPECTED.missingReceivableRole)
    })

    it("skips a disabled connector and a tool whose schema is not approved", async () => {
        const { gateway } = await build(gatewayScenarioOf("unavailable-roles"))

        await expect(gateway.toolForRole("ws-1", "identity.find")).resolves.toMatchObject({ code: "no_capability" })
        await expect(gateway.toolForRole("ws-1", "payment.credits.list")).resolves.toMatchObject({
            code: "no_capability",
        })
    })
})

describe("McpGatewayService.readiness", () => {
    it("is ready when every asked role has a usable tool, and lists the providers of every role", async () => {
        const { gateway } = await build(gatewayScenarioOf("readiness"))

        await expect(gateway.readiness("ws-1", ["payment.credits.list", "identity.find"])).resolves.toEqual(
            EXPECTED.readyRoles,
        )
        await expect(gateway.readiness("ws-1", ["payment.credits.list", "receivable.find"])).resolves.toMatchObject(
            EXPECTED.missingReceivableReadiness,
        )
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
        const { gateway, remote, callLog } = await build(gatewayScenarioOf("schema-refusal"))

        await expect(gateway.call(CALLER, "hakuen.booking.hold", { roomType: "deluxe" })).resolves.toEqual(
            refusalOf("schema_unapproved", "hakuen.booking.hold"),
        )
        await expect(gateway.call(CALLER, "shop.stay.current", {})).resolves.toMatchObject({
            code: "schema_unapproved",
        })
        expect(remote.call).not.toHaveBeenCalled()
        expect(linesOf(callLog).map((line) => [line.tool, line.outcome, line.errorCode])).toEqual(
            EXPECTED.schemaRefusals,
        )
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
        const { gateway, callLog, remote } = await build(gatewayScenarioOf("approval"))

        await expect(gateway.call(CALLER, "hakuen.booking.cancel", { bookingId: "b1" })).resolves.toEqual(
            EXPECTED.askModeRefusal,
        )
        await expect(
            gateway.call(CALLER, "hakuen.booking.confirm", { holdId: "h1", discountPct: 15 }),
        ).resolves.toEqual({ ok: false, code: "approval_required", reason: "over_constraint" })
        expect(remote.call).not.toHaveBeenCalled()
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual(EXPECTED.approvalOutcomes)
    })
})

describe("McpGatewayService write identities", () => {
    it.each(MISSING_WRITE_IDENTITIES)(
        "refuses $label before claiming or acting",
        async ({ caller, native: isNative }) => {
            const { gateway, remote, native, receipts, callLog } = await build(
                gatewayScenarioOf("missing-identity"),
                WRITE_NATIVE_MANIFEST,
            )
            const role = await gateway.toolForRole(caller.workspaceId, "receivable.find")
            assert(role.ok)
            const tool = isNative ? "sepay.transactions.list" : role.tool.name

            const first = await gateway.call(caller, tool, {})
            const retried = await gateway.call(caller, tool, {})
            expect([first, retried]).toEqual([
                refusalOf("idempotency_key_required", tool),
                refusalOf("idempotency_key_required", tool),
            ])
            expect(remote.call).not.toHaveBeenCalled()
            expect(native.invoke).not.toHaveBeenCalled()
            expect(receipts.run).not.toHaveBeenCalled()
            expect(callLog.append).toHaveBeenCalledTimes(2)
            expect(linesOf(callLog)[0]).toMatchObject({ outcome: "refused", errorCode: "idempotency_key_required" })
        },
    )

    it.each(VALID_WRITE_IDENTITIES)(
        "claims a write with an operation key or its work-item fallback %j",
        async (caller) => {
            const { gateway, remote, receipts } = await build()

            await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(EXPECTED.reply)
            expect(receipts.run).toHaveBeenCalledTimes(1)
            expect(remote.call).toHaveBeenCalledTimes(1)
        },
    )
})

describe("McpGatewayService.call remote connectors", () => {
    it("calls the remote tool with the bearer opened from its sealed row, masks the audit and answers the result", async () => {
        const { gateway, remote, callLog } = await build()

        await expect(
            gateway.call({ ...CALLER, opKey: "reveal-1" }, "hakuen.keycode.reveal", { stayId: "s1" }),
        ).resolves.toEqual(EXPECTED.reply)
        expect(remote.call).toHaveBeenCalledWith(EXPECTED.revealRequest)
        expect(linesOf(callLog)[0]).toMatchObject(EXPECTED.revealedAudit)
    })

    it.each(REPLAY_SCHEMA_CHANGES)("replays when the approved schema $label", async (scenario) => {
        const { gateway, remote, receipts, grants, connectors } = await build()
        const { caller, args, before, after, firstHasReplayKey } = scenario
        connectors.list.mockResolvedValueOnce([before]).mockResolvedValueOnce([after])

        const first = await gateway.call(caller, "hakuen.booking.confirm", args)
        const retried = await gateway.call(caller, "hakuen.booking.confirm", args)

        expect([first, retried]).toEqual(EXPECTED.retriedAnswers)
        expect(remote.call).toHaveBeenCalledTimes(1)
        expect(receipts.run).toHaveBeenCalledTimes(2)
        expect(receipts.run.mock.calls[1]?.[1]).toBe(receipts.run.mock.calls[0]?.[1])
        expect(grants.listOfAgent).toHaveBeenCalledTimes(2)
        expect(connectors.list).toHaveBeenCalledTimes(2)
        const forwarded = remote.call.mock.calls[0]?.[0].args
        expect(forwarded?.idempotencyKey !== undefined).toBe(firstHasReplayKey)
    })

    it("sends the same replay key for every run of the same step, and another for another step", async () => {
        const { gateway, remote } = await build()
        const step: GatewayCaller = { ...CALLER, workItemId: "item-1" }
        const hold = { roomType: "deluxe", checkIn: "2026-10-24", nights: 2, guests: 2, guestId: "g1" }

        await gateway.call(step, "hakuen.booking.hold", hold)
        await gateway.call(step, "hakuen.booking.hold", hold)
        await gateway.call({ ...step, opKey: "item-1:rehold" }, "hakuen.booking.hold", hold)
        await gateway.call(step, "hakuen.booking.hold", { ...hold, idempotencyKey: "mine" })

        const keys = remote.call.mock.calls.map(([request]) => request.args.idempotencyKey)
        expect(keys[0]).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(keys[1]).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(keys[1]).not.toBe(keys[0])
        expect(keys.slice(2)).toEqual(["mine"])
    })

    it("replays a retried HAKUEN write's result without calling HAKUEN twice, even without a remote replay argument", async () => {
        const { gateway, remote, receipts, grants } = await build()
        const caller = { ...CALLER, opKey: "customer-message:confirm" }
        const args = { holdId: "hold-1", discountPct: 0 }

        const first = await gateway.call(caller, "hakuen.booking.confirm", args)
        const retried = await gateway.call(caller, "hakuen.booking.confirm", { discountPct: 0, holdId: "hold-1" })

        expect([first, retried]).toEqual(EXPECTED.retriedAnswers)
        expect(remote.call).toHaveBeenCalledTimes(1)
        expect(receipts.run).toHaveBeenCalledTimes(2)
        expect(grants.listOfAgent).toHaveBeenCalledTimes(2)
        await expect(gateway.call(reroutedCallerOf(caller), "hakuen.booking.confirm", args)).resolves.toEqual(first)
        expect(remote.call).toHaveBeenCalledTimes(1)
        await gateway.call({ ...caller, opKey: "next-message:confirm" }, "hakuen.booking.confirm", args)
        await gateway.call({ ...caller, workspaceId: "ws-2" }, "hakuen.booking.confirm", args)
        expect(remote.call).toHaveBeenCalledTimes(3)
    })

    it("answers a tool refusal as tool_error with the masked summary", async () => {
        const { gateway, remote, callLog } = await build()
        remote.call.mockResolvedValue({ isError: true, value: { error: { code: "NO_AVAILABILITY" } } })

        await expect(gateway.call(CALLER, "hakuen.rooms.searchAvailability", {})).resolves.toEqual(EXPECTED.toolRefusal)
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "error", errorCode: "tool_error" })
    })
})

describe("McpGatewayService.call remote connectors", () => {
    it("answers unavailable on a timeout or a failure, logs it, and reaches a server without a URL as empty", async () => {
        const { gateway, remote, callLog, logger } = await build({ rows: [connectorOf({ url: null })] })
        const timeout = new McpError({ code: McpErrorCode.Timeout, params: { url: "" } })
        remote.call.mockRejectedValueOnce(timeout).mockRejectedValueOnce(new Error("boom"))

        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(EXPECTED.readTimeout)
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(EXPECTED.readFailure)
        expect(remote.call.mock.calls[0]?.[0].endpoint.url).toBe("")
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual(EXPECTED.failedReadOutcomes)
        expect(logger.error).toHaveBeenCalledWith(McpGatewayLogEvent.CallFailed, timeout, EXPECTED.failedReadContext)
    })

    it("runs an approved replay of a side-effect with no rule and records who approved it", async () => {
        const { gateway, callLog } = await build({ grants: [] })

        await expect(
            gateway.call({ ...CALLER, workItemId: "approved-item", approvedBy: "manager-1" }, "hakuen.booking.cancel", {
                bookingId: "b1",
            }),
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

        await expect(gateway.call(step, "hakuen.booking.hold", { roomType: "deluxe" })).resolves.toEqual(EXPECTED.held)
        const [first, second] = remote.call.mock.calls.map(([request]) => request.args)
        expect(second).toEqual(first)
        expect(first?.idempotencyKey).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(linesOf(callLog).map((line) => line.outcome)).toEqual(["ok"])
    })

    it.each(TIMED_OUT_WRITES)("keeps the unknown outcome for $label", async ({ tool, args, attempts }) => {
        const { gateway, remote, callLog, receipts } = await build()
        const caller = { ...CALLER, opKey: "timed-out-write" }
        remote.call.mockRejectedValue(timeout())

        const first = await gateway.call(caller, tool, args)
        expect(first).toEqual(EXPECTED.unknownWriteOutcome)
        await expect(gateway.call(caller, tool, args)).resolves.toEqual(first)
        expect(remote.call).toHaveBeenCalledTimes(attempts)
        expect(receipts.run).toHaveBeenCalledTimes(2)
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual(EXPECTED.unknownWriteOutcomes)
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
    it("does not consume a write's operation key while its connector's breaker is open", async () => {
        const { gateway, remote, receipts, clock } = await build()
        remote.call.mockRejectedValue(new Error("down"))
        for (let attempt = 0; attempt < 5; attempt += 1) await gateway.call(CALLER, "hakuen.stay.current", {})
        const caller = { ...CALLER, opKey: "confirm-after-recovery" }

        await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(EXPECTED.circuitOpen)
        expect(receipts.run).not.toHaveBeenCalled()
        clock.advance(120_000)
        remote.call.mockResolvedValue({ isError: false, value: { bookingId: "b1" } })
        await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(answerOf({ bookingId: "b1" }))
        expect(receipts.run).toHaveBeenCalledTimes(1)
        expect(remote.call).toHaveBeenCalledTimes(6)
    })

    it("does not take the half-open probe when it returns a stored write result", async () => {
        const { gateway, remote, clock } = await build()
        const caller = { ...CALLER, opKey: "already-confirmed" }
        await gateway.call(caller, "hakuen.booking.confirm", {})
        remote.call.mockRejectedValue(new Error("down"))
        for (let attempt = 0; attempt < 5; attempt += 1) await gateway.call(CALLER, "hakuen.stay.current", {})
        clock.advance(120_000)

        await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(EXPECTED.reply)
        remote.call.mockResolvedValue({ isError: false, value: { stay: null } })
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(answerOf({ stay: null }))
        expect(remote.call).toHaveBeenCalledTimes(7)
    })

    it("opens after five failures of a connector, refuses it meanwhile and audits it, while another connector runs", async () => {
        const { gateway, remote, native, callLog } = await build({ grants: [grantOf(), grantOf({ tool: "sepay.*" })] })
        remote.call.mockRejectedValue(new Error("down"))
        for (let attempt = 0; attempt < 5; attempt += 1) await gateway.call(CALLER, "hakuen.stay.current", {})

        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(EXPECTED.circuitOpen)
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

        await expect(gateway.call(CALLER, "sepay.transactions.list", { limit: 5 })).resolves.toEqual(EXPECTED.native)
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
