import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { McpCallLogService } from "@modules/domain/mcp-call-log"
import { McpConnectorsService } from "@modules/domain/mcp-connectors"
import { GatewayReceiptsService } from "@modules/domain/mcp-gateway-receipts"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { McpConnectorAccessService, McpToolGrantsService } from "@modules/domain/mcp-tool-grants"
import type { ProviderAttachmentView } from "@modules/domain/mcp-tool-grants"
import { MCP_REMOTE, McpError, McpErrorCode } from "@modules/integrations/mcp"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { QueueTimeout } from "@modules/platform/queue"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.service"
import { gatewayArgumentsSchema } from "./gateway-tools.schema"
import type { GatewayCaller, GatewayRun, NativeAdapter, NativeConnectorManifest } from "./mcp-gateway.contracts"
import { DATA_RIGHTS_GATE, MCP_GATEWAY_OPTIONS, NATIVE_ADAPTERS } from "./mcp-gateway.decorators"
import { TOOL_GRAPH_GATE } from "./tool-graph.decorators"
import { McpConnectorCredentialService } from "./mcp-connector-credential.service"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"
import { ProviderAbilitiesService } from "./provider-abilities.service"
import { McpGatewayService } from "./mcp-gateway.service"
import { NativeRunnerService } from "./native-runner.service"
import { GATEWAY_CALLER as CALLER, toolGrantRowOf as grantOf } from "@tests/fixtures/builders/mcp-gateway.builder"
import * as gw from "@tests/fixtures/builders/mcp-gateway.builder"
import {
    gatewayScenarioOf,
    gatewayLinesOf as linesOf,
    GATEWAY_SCENARIO_EXPECTED as EXPECTED,
} from "@tests/fixtures/builders/mcp-gateway-scenario.builder"
import * as gws from "@tests/fixtures/builders/mcp-gateway-scenario.builder"
import * as gwt from "@tests/fixtures/builders/mcp-gateway-taint.builder"

const SAFE_REPLY = { ...EXPECTED.reply, summary: '{"holdId":"h1","code":"***"}' }
type Dependencies = ConstructorParameters<typeof McpGatewayService>

const build = async (
    setup: gw.GatewaySpecSetup = {},
    manifest = gwt.OPEN_SEPAY_MANIFEST,
    added: ReadonlyArray<NativeConnectorManifest> = [],
    attachments: ReadonlyArray<ProviderAttachmentView> | null = null,
) => {
    const clock = new FakeClock("2026-10-20T02:00:00.000Z")
    const logger = mock<Dependencies[3]>()
    const remote = mock<Dependencies[4]>()
    const native = mock<NativeAdapter>({ manifest })
    const timeout = mock<QueueTimeout>()
    const connectors = mock<Dependencies[5]>()
    const grants = mock<Dependencies[6]>()
    const callLog = mock<Dependencies[7]>()
    const credentials = mock<Dependencies[8]>()
    const receipts = mock<Dependencies[9]>()
    const runner = mock<Dependencies[10]>()
    const dataRights = mock<NonNullable<Dependencies[12]>>()
    const graph = mock<NonNullable<Dependencies[11]>>()
    const cancel = mock<gw.GatewayCancellation>().cancel
    const access = mock<McpConnectorAccessService>()
    access.listOfAgent.mockResolvedValue(attachments ?? [])
    access.listOfWorkspace.mockResolvedValue(attachments ?? [])
    access.defaultAccountOf.mockResolvedValue(null)
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.ofProvider.mockImplementation((_workspaceId, provider) =>
        Promise.resolve(
            provider === "sepay"
                ? [mock<ConnectionStatusFacts>({ id: "conn-mb", name: "MB", status: "connected", accountMasked: null })]
                : [],
        ),
    )
    const abilities = new ProviderAbilitiesService(access, mock<AgentDirectoryService>(), bindings)
    const adapters = [native, ...added.map((extra) => mock<NativeAdapter>({ manifest: extra }))]
    const doubles = {
        clock,
        logger,
        remote,
        native,
        timeout,
        connectors,
        grants,
        callLog,
        credentials,
        receipts,
        dataRights,
        graph,
        cancel,
    }
    gw.arrangeGatewayDoubles(setup, doubles)
    runner.run.mockImplementation((...call) => new NativeRunnerService(timeout).run(...call))
    gws.arrangeGatewayScenario(setup, doubles)
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpGatewayService,
            { provide: MCP_GATEWAY_OPTIONS, useValue: { defaultTimeoutMs: setup.timeoutMs ?? 4000 } },
            { provide: NATIVE_ADAPTERS, useValue: adapters },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: MCP_REMOTE, useValue: remote },
            { provide: McpConnectorsService, useValue: connectors },
            { provide: McpToolGrantsService, useValue: grants },
            { provide: McpCallLogService, useValue: callLog },
            { provide: McpConnectorCredentialService, useValue: credentials },
            { provide: GatewayReceiptsService, useValue: receipts },
            { provide: NativeRunnerService, useValue: runner },
            { provide: DATA_RIGHTS_GATE, useValue: dataRights },
            { provide: TOOL_GRAPH_GATE, useValue: graph },
            ...(attachments === null ? [] : [{ provide: ProviderAbilitiesService, useValue: abilities }]),
        ],
    }).compile()
    return { gateway: moduleRef.get(McpGatewayService), access, ...doubles }
}

describe("McpGatewayService registry and discovery", () => {
    it("lists every native connector with its row's status and bounded time limit, and the remote rows", async () => {
        const { gateway } = await build(gatewayScenarioOf("registry"))
        const connectors = await gateway.connectorsOf("ws-1")
        expect(connectors.map((connector) => [connector.manifest.key, connector.status, connector.timeoutMs])).toEqual(
            EXPECTED.connectorStates,
        )
        expect(connectors[0]?.approvedTools).toBeNull()
        expect(connectors[1]?.approvedTools?.size).toBe(gw.GATEWAY_CATALOG.length)
    })

    it("finds an adapter an app added beside the first, with the same time limit", async () => {
        const { gateway, native } = await build(gatewayScenarioOf("registry"), SEPAY_MANIFEST, [
            { ...SEPAY_MANIFEST, key: "brain", name: "Brain" },
        ])
        const connectors = await gateway.connectorsOf("ws-1")
        expect(native.invoke).not.toHaveBeenCalled()
        expect(connectors.map((connector) => connector.manifest.key)).toEqual(["sepay", "brain", "hakuen"])
        expect(connectors[1]).toMatchObject({ status: "active", timeoutMs: 4000, approvedTools: null })
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

    it.each(gws.GATEWAY_DESCRIPTIONS)("describes $name under its schema and grant", async ({ name, answer }) => {
        const { gateway } = await build(gatewayScenarioOf("description"))
        await expect(gateway.describe(CALLER, name)).resolves.toEqual(answer)
    })
})

describe("McpGatewayService.toolForRole", () => {
    it.each(gws.GATEWAY_ROLE_RESOLUTIONS)("resolves $role with native priority", async ({ role, answer }) => {
        const { gateway } = await build(gatewayScenarioOf("roles"))
        await expect(gateway.toolForRole("ws-1", role)).resolves.toEqual(answer)
    })

    it.each(gws.UNAVAILABLE_GATEWAY_ROLES)("refuses an unavailable %s provider", async (role) => {
        const { gateway } = await build(gatewayScenarioOf("unavailable-roles"))
        await expect(gateway.toolForRole("ws-1", role)).resolves.toMatchObject({ code: "no_capability" })
    })
})

describe("McpGatewayService.readiness", () => {
    it.each(gws.GATEWAY_READINESS)("reports readiness and providers with $label", async ({ roles, answer }) => {
        const { gateway } = await build(gatewayScenarioOf("readiness"))
        await expect(gateway.readiness("ws-1", roles)).resolves.toEqual(answer)
    })
})

describe("McpGatewayService.call refusals", () => {
    it.each(gws.INVALID_GATEWAY_TOOLS)("refuses $name before grants or audit", async ({ name, answer }) => {
        const { gateway, grants, callLog } = await build(gatewayScenarioOf("invalid-tools"))
        await expect(gateway.call(CALLER, name, {})).resolves.toEqual(answer)
        expect(grants.listOfAgent).not.toHaveBeenCalled()
        expect(callLog.append).not.toHaveBeenCalled()
    })

    it("refuses a remote tool whose live schema is not the approved one, and audits it", async () => {
        const { gateway, remote, callLog } = await build(gatewayScenarioOf("schema-refusal"))
        await expect(gateway.call(CALLER, "hakuen.booking.hold", { roomType: "deluxe" })).resolves.toEqual(
            gw.refusalOf("schema_unapproved", "hakuen.booking.hold"),
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
        await expect(gateway.call(CALLER, "sepay.transaction.list", { limit: 5 })).resolves.toEqual(
            gw.refusalOf("not_granted", "sepay.transaction.list"),
        )
        expect(native.invoke).not.toHaveBeenCalled()
        expect(linesOf(callLog)).toEqual([gw.refusedReadLineOf()])
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
    it.each(gws.MISSING_WRITE_IDENTITIES)("refuses $label before acting", async ({ caller, native: isNative }) => {
        const { gateway, remote, native, receipts, callLog } = await build(
            gatewayScenarioOf("missing-identity"),
            gws.WRITE_NATIVE_MANIFEST,
        )
        const role = await gateway.toolForRole(caller.workspaceId, "receivable.find")
        assert(role.ok)
        const tool = isNative ? "sepay.transaction.list" : role.tool.name
        const first = await gateway.call(caller, tool, {})
        const retried = await gateway.call(caller, tool, {})
        const refused = gw.refusalOf("idempotency_key_required", tool)
        expect([first, retried]).toEqual([refused, refused])
        expect(remote.call).not.toHaveBeenCalled()
        expect(native.invoke).not.toHaveBeenCalled()
        expect(receipts.run).not.toHaveBeenCalled()
        expect(callLog.append).toHaveBeenCalledTimes(2)
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "refused", errorCode: "idempotency_key_required" })
    })

    it.each(gws.VALID_WRITE_IDENTITIES)("claims a write with identity %j", async (caller) => {
        const { gateway, remote, receipts } = await build()
        await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(SAFE_REPLY)
        expect(receipts.run).toHaveBeenCalledTimes(1)
        expect(remote.call).toHaveBeenCalledTimes(1)
    })
})

describe("McpGatewayService.call remote connectors", () => {
    it("calls the remote tool with the bearer opened from its sealed row, masks the audit and answers the result", async () => {
        const { gateway, remote, callLog } = await build()
        await expect(
            gateway.call({ ...CALLER, opKey: "reveal-1" }, "hakuen.keycode.reveal", { stayId: "s1" }),
        ).resolves.toEqual(SAFE_REPLY)
        expect(remote.call).toHaveBeenCalledWith(EXPECTED.revealRequest)
        expect(linesOf(callLog)[0]).toMatchObject(EXPECTED.revealedAudit)
    })

    it.each(gws.REPLAY_SCHEMA_CHANGES)("replays when the approved schema $label", async (scenario) => {
        const { gateway, remote, receipts, grants, connectors } = await build()
        const { caller, args, before, after, firstHasReplayKey } = scenario
        connectors.list.mockResolvedValueOnce([before]).mockResolvedValueOnce([after])
        const first = await gateway.call(caller, "hakuen.booking.confirm", args)
        const retried = await gateway.call(caller, "hakuen.booking.confirm", args)
        expect([first, retried]).toEqual([SAFE_REPLY, SAFE_REPLY])
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
        const keys = await gwt.replayedHoldKeysOf(gateway, remote, CALLER)
        expect(keys[0]).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(keys[1]).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(keys[1]).not.toBe(keys[0])
        expect(keys.slice(2)).toEqual(["mine"])
    })

    it("replays a retried HAKUEN write's result without calling HAKUEN twice, even without a remote replay argument", async () => {
        const { gateway, remote, receipts, grants } = await build()
        const { caller, args, first, retried } = await gwt.replayedConfirmationOf(gateway, CALLER)
        expect([first, retried]).toEqual([SAFE_REPLY, SAFE_REPLY])
        expect(remote.call).toHaveBeenCalledTimes(1)
        expect(receipts.run).toHaveBeenCalledTimes(2)
        expect(grants.listOfAgent).toHaveBeenCalledTimes(2)
        await expect(gateway.call(gws.reroutedCallerOf(caller), "hakuen.booking.confirm", args)).resolves.toEqual(first)
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
    it("answers unavailable on a timeout or a failure, logs it, and reaches a server without a URL as empty", async () => {
        const { gateway, remote, callLog, logger } = await build({ rows: [gw.remoteConnectorRowOf({ url: null })] })
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
        const caller = { ...CALLER, workItemId: "approved-item", approvedBy: "manager-1" }
        await expect(gateway.call(caller, "hakuen.booking.cancel", { bookingId: "b1" })).resolves.toMatchObject({
            ok: true,
        })
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "ok", approvedBy: "manager-1" })
    })
})

describe("McpGatewayService.call writes that time out", () => {
    const timeout = () => new McpError({ code: McpErrorCode.Timeout, params: { url: "" } })

    it("sends a write with its replay key once more and answers what the server stored", async () => {
        const { gateway, remote, callLog } = await build()
        remote.call.mockRejectedValueOnce(timeout()).mockResolvedValueOnce({ isError: false, value: { holdId: "h1" } })
        const step: GatewayCaller = { ...CALLER, workItemId: "item-1" }
        await expect(gateway.call(step, "hakuen.booking.hold", { roomType: "deluxe" })).resolves.toEqual(gwt.HELD_REPLY)
        const [first, second] = remote.call.mock.calls.map(([request]) => request.args)
        expect(second).toEqual(first)
        expect(first?.idempotencyKey).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(linesOf(callLog).map((line) => line.outcome)).toEqual(["ok"])
    })

    it.each(gws.TIMED_OUT_WRITES)("keeps the unknown outcome for $label", async ({ tool, args, attempts }) => {
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
        await gws.openRemoteGatewayBreaker(gateway, remote)
        const caller = { ...CALLER, opKey: "confirm-after-recovery" }
        await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(EXPECTED.circuitOpen)
        expect(receipts.run).not.toHaveBeenCalled()
        clock.advance(120_000)
        remote.call.mockResolvedValue({ isError: false, value: { bookingId: "b1" } })
        await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(gwt.CONFIRMED_REPLY)
        expect(receipts.run).toHaveBeenCalledTimes(1)
        expect(remote.call).toHaveBeenCalledTimes(6)
    })

    it("does not take the half-open probe when it returns a stored write result", async () => {
        const { gateway, remote, clock } = await build()
        const caller = { ...CALLER, opKey: "already-confirmed" }
        await gateway.call(caller, "hakuen.booking.confirm", {})
        await gws.openRemoteGatewayBreaker(gateway, remote)
        clock.advance(120_000)
        await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(SAFE_REPLY)
        remote.call.mockResolvedValue({ isError: false, value: { stay: null } })
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(gwt.CURRENT_STAY_REPLY)
        expect(remote.call).toHaveBeenCalledTimes(7)
    })

    it("opens after five failures of a connector, refuses it meanwhile and audits it, while another connector runs", async () => {
        const { gateway, remote, native, callLog } = await build({ grants: [grantOf(), grantOf({ tool: "sepay.*" })] })
        await gws.openRemoteGatewayBreaker(gateway, remote)
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(EXPECTED.circuitOpen)
        await expect(gateway.call(CALLER, "sepay.transaction.list", {})).resolves.toMatchObject({ ok: true })
        await expect(
            gateway.call({ ...CALLER, workspaceId: "ws-2" }, "hakuen.stay.current", {}),
        ).resolves.toMatchObject({ detail: "internal" })
        expect(remote.call).toHaveBeenCalledTimes(6)
        expect(native.invoke).toHaveBeenCalledTimes(1)
        expect(linesOf(callLog)[5]).toMatchObject({ outcome: "circuit_open", errorCode: "unavailable" })
    })

    it("lets one probe through after the pause, refuses the others while it runs, and closes when it succeeds", async () => {
        const { gateway, remote, clock } = await build()
        await gws.openRemoteGatewayBreaker(gateway, remote)
        clock.advance(120_000)
        const answer = gws.pendingRemoteReplyOf(remote)
        const probe = gateway.call(CALLER, "hakuen.stay.current", {})
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toMatchObject({ detail: "circuit_open" })
        answer({ isError: false, value: { stay: null } })
        await expect(probe).resolves.toEqual({ ok: true, value: { stay: null }, summary: '{"stay":null}' })
        remote.call.mockResolvedValue({ isError: false, value: { stay: null } })
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toMatchObject({ ok: true })
    })
})

describe("McpGatewayService.call native connectors", () => {
    it.each(gws.INVALID_GATEWAY_ARGUMENTS)("rejects $label before grants or execution", async (scenario) => {
        const { gateway, connectors, native, remote, grants, timeout, callLog } = await build(scenario.setup)
        await expect(gateway.call(CALLER, scenario.tool, scenario.args)).resolves.toEqual(EXPECTED.invalidArguments)
        expect(connectors.list).toHaveBeenCalledTimes(scenario.connectorReads)
        expect(grants.listOfAgent).not.toHaveBeenCalled()
        expect(native.invoke).not.toHaveBeenCalled()
        expect(remote.call).not.toHaveBeenCalled()
        expect(timeout.schedule).not.toHaveBeenCalled()
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode, line.argsMaskedJson])).toEqual(
            scenario.audit,
        )
    })

    it("returns and audits invalid arguments without opening the connector's breaker or logging a server failure", async () => {
        const { gateway, native, callLog, logger } = await build({ grants: [grantOf({ tool: "sepay.*" })] })
        for (let attempt = 0; attempt < 6; attempt += 1) {
            await expect(gateway.call(CALLER, "sepay.transaction.list", { limit: 51 })).resolves.toEqual(
                gw.refusalOf("invalid_arguments", "Invalid tool arguments"),
            )
        }
        await expect(gateway.call(CALLER, "sepay.transaction.list", { limit: 1 })).resolves.toMatchObject({ ok: true })
        expect(native.invoke).toHaveBeenCalledTimes(1)
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "refused", errorCode: "invalid_arguments" })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("lets a valid probe run after an invalid native call during breaker recovery", async () => {
        const { gateway, native, clock } = await build({ grants: [grantOf({ tool: "sepay.*" })] })
        await gwt.openNativeGatewayBreaker(gateway, native, clock, CALLER)
        await expect(gateway.call(CALLER, "sepay.transaction.list", { limit: 51 })).resolves.toMatchObject({
            code: "invalid_arguments",
        })
        native.invoke.mockResolvedValue({ transactions: [] })
        await expect(gateway.call(CALLER, "sepay.transaction.list", { limit: 1 })).resolves.toMatchObject({ ok: true })
        expect(native.invoke).toHaveBeenCalledTimes(6)
    })
})

describe("McpGatewayService internal-only tools", () => {
    it("keeps a customer conversation from the tool, audited before the adapter, and shows it outside one", async () => {
        const name = "sepay.transaction.list"
        const { gateway, native, callLog } = await build(
            { grants: [grantOf({ tool: "sepay.*" })] },
            gwt.INTERNAL_SEPAY_MANIFEST,
        )
        await expect(gateway.call(CALLER, name, {})).resolves.toEqual(gw.refusalOf("internal_only", name))
        await expect(gateway.search(CALLER, "bank transactions", 5)).resolves.toEqual([])
        await expect(gateway.describe(CALLER, name)).resolves.toBeNull()
        expect(native.invoke).not.toHaveBeenCalled()
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "refused", errorCode: "internal_only" })
        const outside = { ...CALLER, conversationId: null }
        await expect(gateway.call(outside, name, {})).resolves.toMatchObject({ ok: true })
        await expect(gateway.describe(outside, name)).resolves.toMatchObject({ name })
    })
})

describe("McpGatewayService tainted turns", () => {
    it("asks a person for a write of a turn that read tainted text, until one approves it or the window ends", async () => {
        const { gateway, callLog, clock } = await build(
            { grants: [grantOf({ tool: "sepay.*" })] },
            gwt.TAINTING_MANIFEST,
        )
        await expect(gwt.taintedTurnOf(gateway, clock, CALLER)).resolves.toEqual(gwt.taintedTurnExpected)
        expect(linesOf(callLog).map((line) => line.errorCode)).toContain("tainted_input")
    })

    // FX4 (D-P11-5): the team-chat turn reads the brain (a tainting read) and then files a truth change. With no grant row the write
    // asked `no_rule`, and after the brain read it would ask `tainted_input`: a second person in front of the founder's own card.
    it("runs a write that only files a request (no grant row, after a tainting read in the same turn): no approval asked", async () => {
        const base = gwt.TAINTING_MANIFEST.tools[0]
        if (base === undefined) throw new Error("the tainting manifest names no tool")
        const manifest: NativeConnectorManifest = {
            ...gwt.TAINTING_MANIFEST,
            tools: [
                { ...base, name: "read", internalOnly: false, taints: true },
                { ...base, name: "propose", internalOnly: false, scope: "write", filesRequest: true },
                { ...base, name: "act", internalOnly: false, scope: "write" },
            ],
        }
        // Only the read holds a grant row: the two writes have none.
        const { gateway, native, callLog } = await build({ grants: [grantOf({ tool: "sepay.read", constraints: [] })] }, manifest)
        native.invoke.mockResolvedValue({ outcome: "filed" })
        const writer = { ...CALLER, opKey: "run-1:answer:tool:1" }

        await gateway.call(writer, "sepay.read", {})
        const proposed = await gateway.call(writer, "sepay.propose", {})
        const acted = await gateway.call(writer, "sepay.act", {})

        expect(proposed).toMatchObject({ ok: true, value: { outcome: "filed" } })
        expect(acted).toEqual({ ok: false, code: "approval_required", reason: "no_rule" })
        expect(linesOf(callLog).map((line) => [line.tool, line.outcome, line.errorCode])).toEqual([
            ["sepay.read", "ok", null],
            ["sepay.propose", "ok", null],
            ["sepay.act", "approval", "no_rule"],
        ])
    })
})

describe("McpGatewayService data rights", () => {
    it("refuses a native read with no data right and audits it, and shows the read without the fields a right hides", async () => {
        const refused = await build({ grants: [grantOf({ tool: "sepay.*" })], rights: [] })
        const narrowed = await build({ grants: [grantOf({ tool: "sepay.*" })], rights: [gwt.PAYMENT_RIGHT] })
        narrowed.native.invoke.mockResolvedValue({ transactions: [{ id: "t1", account: "0123" }] })
        await expect(refused.gateway.call(CALLER, "sepay.transaction.list", {})).resolves.toEqual(
            gw.refusalOf("not_granted", "no_data_right"),
        )
        expect(refused.native.invoke).not.toHaveBeenCalled()
        expect(linesOf(refused.callLog)[0]).toMatchObject({ outcome: "refused", errorCode: "no_data_right" })
        await expect(narrowed.gateway.call(CALLER, "sepay.transaction.list", {})).resolves.toEqual(gwt.HIDDEN_REPLY)
    })
})

describe("McpGatewayService the graph of the agent on writes", () => {
    it.each(gwt.GRAPH_HOLDS)("holds %j, returns %j and audits", async (verdict, answer, outcome, code) => {
        const { gateway, remote, callLog, graph } = await build()
        graph.judge.mockResolvedValue(verdict)

        await expect(gateway.call(gwt.GRAPH_CALLER, "hakuen.booking.confirm", {})).resolves.toEqual(answer)

        expect(remote.call).not.toHaveBeenCalled()
        expect(graph.judge).toHaveBeenCalledWith(expect.objectContaining({ agentId: "sales", key: "item-1" }))
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual([[outcome, code]])
    })

    it("runs a write the graph lets through, and never asks the graph about a call a person approved", async () => {
        const run = await build()
        const approved = await build({ grants: [] })
        approved.graph.judge.mockResolvedValue({ kind: "stop" })

        await expect(run.gateway.call(gwt.GRAPH_CALLER, "hakuen.booking.confirm", {})).resolves.toEqual(SAFE_REPLY)
        await expect(
            approved.gateway.call({ ...gwt.GRAPH_CALLER, approvedBy: "manager-1" }, "hakuen.booking.cancel", {
                bookingId: "b1",
            }),
        ).resolves.toMatchObject({ ok: true })

        expect(run.remote.call).toHaveBeenCalledTimes(1)
        expect(approved.graph.judge).not.toHaveBeenCalled()
    })
})

/** A NIVO effect tool as the effect adapter declares it: a write granted by a step's allow-list, kept by the effect ledger. */
const EFFECT_MANIFEST: NativeConnectorManifest = {
    key: "order",
    namespace: "nivo.order",
    name: "NIVO order",
    kind: "native",
    contractVersion: "nivo-effects@1",
    timeoutMs: 15_000,
    tools: [
        {
            name: "create",
            description: "NIVO business action nivo.order.create",
            scope: "write",
            defaultMode: "ask",
            inputSchema: { type: "object" },
            argumentSchema: gatewayArgumentsSchema,
            ledgered: true,
            stepGranted: true,
            taintExempt: true,
        },
    ],
}

/** The graph step of the effect specs: a customer's turn whose allow-list holds the effect tool. */
const STEP_RUN: GatewayRun = {
    turnId: "run-1",
    locale: "vi",
    origin: "customer",
    memberId: null,
    handedOffBy: null,
    leadId: null,
    stepTools: ["nivo.order.create"],
}

/** A caller in that graph step. */
const STEP_CALLER: GatewayCaller = { ...CALLER, opKey: "run-1:step-2:tool:0", turnId: "run-1", run: STEP_RUN }

describe("McpGatewayService NIVO effect tools", () => {
    it("runs an effect tool on the step's allow-list with no grant row, past the receipts, under the manifest's limit", async () => {
        const { gateway, native, receipts } = await build({ grants: [] }, EFFECT_MANIFEST)
        native.invoke.mockResolvedValue({ kind: "order", id: "o-1", facts: { amountVnd: 120_000 } })

        const result = await gateway.call(STEP_CALLER, "nivo.order.create", { leadId: "lead-1" })

        expect(result).toEqual({ ok: true, value: { kind: "order", id: "o-1", facts: { amountVnd: 120_000 } }, summary: expect.any(String) })
        expect(receipts.run).not.toHaveBeenCalled()
        expect(native.invoke).toHaveBeenCalledWith("ws-1", "create", { leadId: "lead-1" }, {
            agentId: "sales",
            conversationId: "conv-1",
            opKey: STEP_CALLER.opKey,
            run: STEP_CALLER.run,
        })
        const [connector] = await gateway.connectorsOf("ws-1")
        expect(connector?.timeoutMs).toBe(15_000)
    })

    it("asks a person for an effect tool the step did not declare, when no grant row applies", async () => {
        const { gateway, native } = await build({ grants: [] }, EFFECT_MANIFEST)
        const caller: GatewayCaller = { ...STEP_CALLER, run: { ...STEP_RUN, stepTools: [] } }

        await expect(gateway.call(caller, "nivo.order.create", { leadId: "lead-1" })).resolves.toEqual({
            ok: false,
            code: "approval_required",
            reason: "no_rule",
        })
        expect(native.invoke).not.toHaveBeenCalled()
    })

    it("lets the owner's grant row decide over the step's allow-list", async () => {
        const { gateway, native } = await build({ grants: [grantOf({ tool: "nivo.order.*", mode: "never", constraints: [] })] }, EFFECT_MANIFEST)

        await expect(gateway.call(STEP_CALLER, "nivo.order.create", { leadId: "lead-1" })).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "nivo.order.create",
        })
        expect(native.invoke).not.toHaveBeenCalled()
    })

    it("answers a refusal fact as a value and audits it as refused with its reason", async () => {
        const { gateway, native, callLog } = await build({ grants: [] }, EFFECT_MANIFEST)
        native.invoke.mockResolvedValue({ kind: "refused", id: "item_unknown", facts: { name: "Trà đào" } })

        const result = await gateway.call(STEP_CALLER, "nivo.order.create", { leadId: "lead-1" })

        assert(result.ok)
        expect(result.value).toEqual({ kind: "refused", id: "item_unknown", facts: { name: "Trà đào" } })
        expect(linesOf(callLog).at(-1)).toMatchObject({ tool: "nivo.order.create", outcome: "refused", errorCode: "item_unknown" })
    })

    it("still refuses an effect tool called with no step key", async () => {
        const { gateway, native } = await build({ grants: [] }, EFFECT_MANIFEST)
        const caller: GatewayCaller = { ...STEP_CALLER, opKey: undefined }

        await expect(gateway.call(caller, "nivo.order.create", { leadId: "lead-1" })).resolves.toEqual({
            ok: false,
            code: "idempotency_key_required",
            detail: "nivo.order.create",
        })
        expect(native.invoke).not.toHaveBeenCalled()
    })
})

/** The attachment of the spec agent to SePay, with the abilities ticked. */
const sepay = (abilities: ProviderAttachmentView["abilities"]): ProviderAttachmentView => ({
    agentId: "sales",
    connectionId: "conn-mb",
    provider: "sepay",
    abilities,
})

/** A write tool of the payment provider, as the catalogue names it. */
const QR_MANIFEST: NativeConnectorManifest = {
    ...EFFECT_MANIFEST,
    key: "payment",
    namespace: "nivo.payment",
    tools: EFFECT_MANIFEST.tools.slice(0, 1).map((tool) => ({ ...tool, name: "qr.create" })),
}
const QR_CALLER: GatewayCaller = { ...STEP_CALLER, run: { ...STEP_RUN, stepTools: ["nivo.payment.qr.create"] } }

describe("McpGatewayService provider abilities: the decision table", () => {
    it("not attached: refuses a provider tool, whatever the tool grants say", async () => {
        const { gateway, native, callLog } = await build({}, gwt.OPEN_SEPAY_MANIFEST, [], [
            { agentId: "sales", connectionId: "conn-oa", provider: "zalo_oa", abilities: { "customer.send": "auto" } },
        ])

        await expect(gateway.call(CALLER, "sepay.transaction.list", {})).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "not_attached",
        })
        expect(native.invoke).not.toHaveBeenCalled()
        expect(linesOf(callLog).at(-1)).toMatchObject({ outcome: "refused", errorCode: "not_attached" })
    })

    it("attached, the ability unticked: refuses with ability_off", async () => {
        const { gateway, native } = await build({}, gwt.OPEN_SEPAY_MANIFEST, [], [sepay({ "qr.create": "auto" })])

        await expect(gateway.call(CALLER, "sepay.transaction.list", {})).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "ability_off",
        })
        expect(native.invoke).not.toHaveBeenCalled()
    })

    it("ticked read: runs with no grant row at all", async () => {
        const { gateway, native } = await build({ grants: [] }, gwt.OPEN_SEPAY_MANIFEST, [], [
            sepay({ "transactions.read": "auto" }),
        ])

        const result = await gateway.call(CALLER, "sepay.transaction.list", {})

        expect(result.ok).toBe(true)
        expect(native.invoke).toHaveBeenCalled()
    })

    it("ticked write auto: runs by itself", async () => {
        const { gateway, native } = await build({ grants: [] }, QR_MANIFEST, [], [sepay({ "qr.create": "auto" })])
        native.invoke.mockResolvedValue({ kind: "message", id: "m-1" })

        const result = await gateway.call(QR_CALLER, "nivo.payment.qr.create", { orderId: "o-1" })

        expect(result.ok).toBe(true)
    })

    it("ticked write ask: waits for a person, and runs once that person approved the call", async () => {
        const { gateway, native } = await build({ grants: [] }, QR_MANIFEST, [], [sepay({ "qr.create": "ask" })])
        native.invoke.mockResolvedValue({ kind: "message", id: "m-1" })

        await expect(gateway.call(QR_CALLER, "nivo.payment.qr.create", { orderId: "o-1" })).resolves.toEqual({
            ok: false,
            code: "approval_required",
            reason: "ask_mode",
        })
        expect(native.invoke).not.toHaveBeenCalled()

        const approved = await gateway.call({ ...QR_CALLER, approvedBy: "owner-1" }, "nivo.payment.qr.create", { orderId: "o-1" })
        expect(approved.ok).toBe(true)
    })

    it("a tool that is no provider right is judged as before: the step's own business tool runs, an ungranted one is refused", async () => {
        const { gateway, native, access } = await build(
            { grants: [] },
            { ...EFFECT_MANIFEST, key: "payment", namespace: "nivo.payment" },
            [],
            [],
        )
        native.invoke.mockResolvedValue({ kind: "message", id: "m-1" })
        const caller: GatewayCaller = { ...STEP_CALLER, run: { ...STEP_RUN, stepTools: ["nivo.payment.create"] } }

        const result = await gateway.call(caller, "nivo.payment.create", { orderId: "o-1" })

        expect(result.ok).toBe(true)
        expect(access.listOfAgent).not.toHaveBeenCalled()
    })

    it("the engine's own caller (a module's declared job) is not judged by abilities: its grant row decides", async () => {
        const { gateway, access } = await build({ grants: [] }, gwt.OPEN_SEPAY_MANIFEST, [], [])

        await expect(gateway.call({ ...CALLER, engine: true }, "sepay.transaction.list", {})).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "sepay.transaction.list",
        })
        expect(access.listOfAgent).not.toHaveBeenCalled()
    })

    it("names the agents that hold a ticked ability with the tool beside those holding a grant row", async () => {
        const { gateway, grants } = await build({}, gwt.OPEN_SEPAY_MANIFEST, [], [sepay({ "transactions.read": "auto" })])
        grants.agentsGranted.mockResolvedValue(["a1"])

        await expect(gateway.agentsGranted("ws-1", ["sepay.transaction.list"])).resolves.toEqual(["sales", "a1"])
    })
})
