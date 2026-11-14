import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { ToolReceiptsService } from "@modules/domain/tool-receipts"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { AccountAttachmentsService, ToolGrantsService } from "@modules/domain/tool-grants"
import type { ProviderAttachmentView } from "@modules/domain/tool-grants"
import { CLOCK } from "@modules/platform/clock"
import { PEACH_TEA_VI } from "@tests/fixtures/i18n/mcp-gateway-spec.messages"
import { LOGGER } from "@modules/platform/logging"
import type { QueueTimeout } from "@modules/platform/queue"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.service"
import { toolArgumentsSchema } from "./tool-arguments.schema"
import type { ToolCaller, ToolRun, NativeToolFamily, ToolManifest } from "./tools.contracts"
import { TOOLS_OPTIONS, NATIVE_TOOL_FAMILIES } from "./tools.decorators"
import { NODE_REQUESTS_GATE } from "./node-requests.decorators"
import type { NodeMode, NodeRequestsGate, OptionalNodeRequest } from "./node-mode.policy"
import { ToolsLogEvent } from "./tools.log-events"
import { AgentAccountsService } from "./agent-accounts.service"
import { ToolRegistryService } from "./tool-registry.service"
import { roleIn } from "./tool-call.policy"
import { ToolsError, ToolsErrorCode } from "./errors/tools.error"
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
type Dependencies = ConstructorParameters<typeof ToolRegistryService>

const build = async (
    setup: gw.GatewaySpecSetup = {},
    manifest = gwt.OPEN_SEPAY_MANIFEST,
    added: ReadonlyArray<ToolManifest> = [],
    attachments: ReadonlyArray<ProviderAttachmentView> | null = null,
    requests: NodeRequestsGate | null = null,
) => {
    const clock = new FakeClock("2026-10-20T02:00:00.000Z")
    const logger = mock<Dependencies[3]>()
    const native = mock<NativeToolFamily>({ manifest })
    const [partnerManifest = gw.HAKUEN_MANIFEST, ...others] = setup.families ?? [gw.HAKUEN_MANIFEST]
    const partner = mock<NativeToolFamily>({ manifest: partnerManifest })
    const timeout = mock<QueueTimeout>()
    const grants = mock<Dependencies[4]>()
    const callLog = mock<Dependencies[5]>()
    const receipts = mock<Dependencies[6]>()
    const runner = mock<Dependencies[7]>()
    const cancel = mock<gw.GatewayCancellation>().cancel
    const access = mock<AccountAttachmentsService>()
    access.listOfAgent.mockResolvedValue(attachments ?? [])
    access.listOfWorkspace.mockResolvedValue(attachments ?? [])
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.ofProvider.mockImplementation((_workspaceId, provider) =>
        Promise.resolve(
            provider === "sepay"
                ? [mock<ConnectionStatusFacts>({ id: "conn-mb", name: "MB", status: "connected", accountMasked: null })]
                : [],
        ),
    )
    const accounts = new AgentAccountsService(access, mock<AgentDirectoryService>(), bindings, requests)
    const adapters = [
        native,
        ...added.map((extra) => mock<NativeToolFamily>({ manifest: extra })),
        partner,
        ...others.map((extra) => mock<NativeToolFamily>({ manifest: extra })),
    ]
    const doubles = {
        clock,
        logger,
        native,
        partner,
        timeout,
        grants,
        callLog,
        receipts,
        cancel,
    }
    gw.arrangeGatewayDoubles(doubles)
    runner.run.mockImplementation((...call) => new NativeRunnerService(timeout).run(...call))
    gws.arrangeGatewayScenario(setup, doubles)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ToolRegistryService,
            { provide: TOOLS_OPTIONS, useValue: { defaultTimeoutMs: setup.timeoutMs ?? 4000 } },
            { provide: NATIVE_TOOL_FAMILIES, useValue: adapters },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: ToolGrantsService, useValue: grants },
            { provide: ToolCallLogService, useValue: callLog },
            { provide: ToolReceiptsService, useValue: receipts },
            { provide: NativeRunnerService, useValue: runner },
            ...(attachments === null ? [] : [{ provide: AgentAccountsService, useValue: accounts }]),
            ...(requests === null ? [] : [{ provide: NODE_REQUESTS_GATE, useValue: requests }]),
        ],
    }).compile()
    return { gateway: moduleRef.get(ToolRegistryService), access, ...doubles }
}

/** The reader of the pinned nodes, answering `request` for every step. */
const requestsOf = (request: OptionalNodeRequest): NodeRequestsGate => ({ requestOf: () => Promise.resolve(request) })

/** A node of the given mode, acting through NIVO's own tools only. */
const nodeOf = (mode: NodeMode): OptionalNodeRequest => ({ mode, accounts: [] })

/** The workflow step of the step cases, and the reader answering its node in `auto`. */
const STEP_NODE = { nodeKey: "create-order", versionId: "v-1", workflowId: "wf-1" }
const AUTO_NODE = requestsOf(nodeOf("auto"))

/**
 * A call outside every node that a person approved: the one way a WRITE runs there (nivo-frame `rights`). The cases that use it test
 * what happens to a write once the rights let it run (its identity, receipt, replay key, timeout, breaker), never the rights.
 */
const approved = <C extends ToolCaller>(caller: C): C => ({ ...caller, approvedBy: "member-owner" })

describe("ToolRegistryService registry and discovery", () => {
    it("lists every tool family registered in code with its bounded time limit", async () => {
        const { gateway } = await build(gatewayScenarioOf("registry"))
        const connectors = gateway.familiesOf()
        expect(connectors.map((connector) => [connector.manifest.key, connector.timeoutMs])).toEqual(EXPECTED.connectorStates)
    })

    it("finds an adapter an app added beside the first, with the same time limit", async () => {
        const { gateway, native } = await build(gatewayScenarioOf("registry"), SEPAY_MANIFEST, [
            { ...SEPAY_MANIFEST, key: "brain", name: "Brain" },
        ])
        const connectors = gateway.familiesOf()
        expect(native.invoke).not.toHaveBeenCalled()
        expect(connectors.map((connector) => connector.manifest.key)).toEqual(["sepay", "brain", "hakuen"])
        expect(connectors[1]).toMatchObject({ timeoutMs: 4000 })
    })

    it("answers the grants of an agent and the agents granted a tool", async () => {
        const { gateway, grants } = await build()
        await expect(gateway.grantsOf("ws-1", "sales")).resolves.toEqual(EXPECTED.grants)
        await expect(gateway.agentsGranted("ws-1", ["nivo.tool.payment.*"])).resolves.toEqual(["a1", "a2"])
        expect(grants.listOfAgent).toHaveBeenCalledWith("ws-1", "sales")
        expect(grants.agentsGranted).toHaveBeenCalledWith("ws-1", ["nivo.tool.payment.*"])
    })
})

describe("ToolRegistryService.call refusals", () => {
    it.each(gws.INVALID_GATEWAY_TOOLS)("refuses $name before grants or audit", async ({ name, answer }) => {
        const { gateway, grants, callLog } = await build()
        await expect(gateway.call(CALLER, name, {})).resolves.toEqual(answer)
        expect(grants.listOfAgent).not.toHaveBeenCalled()
        expect(callLog.append).not.toHaveBeenCalled()
    })

    it("refuses a read the agent is not granted and audits it", async () => {
        const { gateway, callLog, native } = await build()
        await expect(gateway.call(CALLER, "nivo.tool.payment.credit.list", { limit: 5 })).resolves.toEqual(
            gw.refusalOf("not_granted", "nivo.tool.payment.credit.list"),
        )
        expect(native.invoke).not.toHaveBeenCalled()
        expect(linesOf(callLog)).toEqual([gw.refusedReadLineOf()])
    })

    it("asks a person for a write outside every node whatever the row's mode (outside_write), and audits the approval", async () => {
        const { gateway, callLog, partner } = await build(gatewayScenarioOf("approval"))
        const asked = { ok: false, code: "approval_required", reason: "outside_write" }
        await expect(gateway.call(CALLER, "hakuen.booking.cancel", { bookingId: "b1" })).resolves.toEqual(asked)
        await expect(gateway.call(CALLER, "hakuen.booking.confirm", { holdId: "h1", discountPct: 15 })).resolves.toEqual(asked)
        expect(partner.invoke).not.toHaveBeenCalled()
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual([
            ["approval", "outside_write"],
            ["approval", "outside_write"],
        ])
    })
})

describe("ToolRegistryService write identities", () => {
    it.each(gws.MISSING_WRITE_IDENTITIES)("refuses $label before acting", async ({ caller, native: isNative }) => {
        const { gateway, partner, native, receipts, callLog } = await build(
            gatewayScenarioOf("missing-identity"),
            gws.WRITE_NATIVE_MANIFEST,
        )
        const role = roleIn(gateway.familiesOf(), "receivable.find")
        assert(role.ok)
        const tool = isNative ? "nivo.tool.payment.credit.list" : role.tool.name
        const first = await gateway.call(approved(caller), tool, {})
        const retried = await gateway.call(approved(caller), tool, {})
        const refused = gw.refusalOf("idempotency_key_required", tool)
        expect([first, retried]).toEqual([refused, refused])
        expect(partner.invoke).not.toHaveBeenCalled()
        expect(native.invoke).not.toHaveBeenCalled()
        expect(receipts.run).not.toHaveBeenCalled()
        expect(callLog.append).toHaveBeenCalledTimes(2)
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "refused", errorCode: "idempotency_key_required" })
    })

    it.each(gws.VALID_WRITE_IDENTITIES)("claims a write with identity %j", async (caller) => {
        const { gateway, partner, receipts } = await build()
        await expect(gateway.call(approved(caller), "hakuen.booking.confirm", {})).resolves.toEqual(SAFE_REPLY)
        expect(receipts.run).toHaveBeenCalledTimes(1)
        expect(partner.invoke).toHaveBeenCalledTimes(1)
    })
})

describe("ToolRegistryService.call: a write the durable receipt answers is still audited", () => {
    it("the same step asking the same call again runs nothing and leaves a line that says it was answered from the receipt, with its node", async () => {
        const { gateway, partner, callLog } = await build({}, gwt.OPEN_SEPAY_MANIFEST, [], null, AUTO_NODE)
        const node = { nodeKey: "ledger", versionId: "wv-9", workflowId: "wf-reconcile" }
        const caller = { ...CALLER, opKey: "run-1:ledger:1", turnId: "run-1", origin: "node" as const, node }

        const first = await gateway.call(caller, "hakuen.booking.confirm", {})
        const again = await gateway.call(caller, "hakuen.booking.confirm", {})

        expect([first, again]).toEqual([SAFE_REPLY, SAFE_REPLY])
        // One execution, two audit lines: the second is the receipt's answer, never a second act.
        expect(partner.invoke).toHaveBeenCalledTimes(1)
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual([
            ["ok", null],
            ["ok", "receipt_replay"],
        ])
        expect(linesOf(callLog)[1]).toMatchObject({
            tool: "hakuen.booking.confirm",
            runId: "run-1",
            originKind: "node",
            nodeKey: "ledger",
            workflowId: "wf-reconcile",
            workflowVersionId: "wv-9",
            recordsRead: null,
            recordsChanged: null,
            connectionId: null,
            provider: null,
            attempt: null,
            chosenBy: null,
        })
    })
})

describe("ToolRegistryService.call partner connectors", () => {
    it("calls the partner family's tool with the arguments, masks the audit and answers the result", async () => {
        const { gateway, partner, callLog } = await build()
        await expect(
            gateway.call(approved({ ...CALLER, opKey: "reveal-1" }), "hakuen.keycode.reveal", { stayId: "s1" }),
        ).resolves.toEqual(SAFE_REPLY)
        expect(partner.invoke.mock.calls.map(([, name, args]) => ({ name, args }))).toEqual([EXPECTED.revealRequest])
        expect(linesOf(callLog)[0]).toMatchObject(EXPECTED.revealedAudit)
    })

    it("sends the same replay key for every run of the same step, and another for another step", async () => {
        const { gateway, partner } = await build()
        const keys = await gwt.replayedHoldKeysOf(gateway, partner, approved(CALLER))
        expect(keys[0]).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(keys[1]).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(keys[1]).not.toBe(keys[0])
        expect(keys.slice(2)).toEqual(["mine"])
    })

    it("replays a retried HAKUEN write's result without calling HAKUEN twice, even without a replay argument", async () => {
        const { gateway, partner, receipts, grants } = await build()
        const { caller, args, first, retried } = await gwt.replayedConfirmationOf(gateway, approved(CALLER))
        expect([first, retried]).toEqual([SAFE_REPLY, SAFE_REPLY])
        expect(partner.invoke).toHaveBeenCalledTimes(1)
        expect(receipts.run).toHaveBeenCalledTimes(2)
        expect(grants.listOfAgent).toHaveBeenCalledTimes(2)
        await expect(gateway.call(gws.reroutedCallerOf(caller), "hakuen.booking.confirm", args)).resolves.toEqual(first)
        expect(partner.invoke).toHaveBeenCalledTimes(1)
        await gateway.call({ ...caller, opKey: "next-message:confirm" }, "hakuen.booking.confirm", args)
        await gateway.call({ ...caller, workspaceId: "ws-2" }, "hakuen.booking.confirm", args)
        expect(partner.invoke).toHaveBeenCalledTimes(3)
    })
})

describe("ToolRegistryService.call partner connectors: the audit, the refusals and the failures", () => {
    it("audits the records an ok call's adapter stated in the provider envelope, and none for any other answer", async () => {
        const { gateway, partner, callLog } = await build()
        const page = { ok: true, status: 200, data: { items: [{ id: 1 }, { id: 2 }] }, truncated: true, omitted: 3 }
        partner.invoke.mockResolvedValueOnce(page)
        await gateway.call(CALLER, "hakuen.rooms.searchAvailability", {})
        await gateway.call(CALLER, "hakuen.rooms.searchAvailability", {})
        expect(linesOf(callLog).map((line) => [line.outcome, line.recordsRead, line.recordsChanged])).toEqual([
            ["ok", 5, null],
            ["ok", null, null],
        ])
    })

    it("answers a tool refusal as tool_error with the masked summary", async () => {
        const { gateway, partner, callLog } = await build()
        partner.invoke.mockRejectedValue(
            new ToolsError({ code: ToolsErrorCode.NativeRefused, params: { reason: "NO_AVAILABILITY" } }),
        )
        await expect(gateway.call(CALLER, "hakuen.rooms.searchAvailability", {})).resolves.toEqual(EXPECTED.toolRefusal)
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "error", errorCode: "tool_error" })
    })
    it("answers unavailable on a timeout or a failure, and logs it", async () => {
        const { gateway, partner, callLog, logger } = await build()
        const timeout = new ToolsError({ code: ToolsErrorCode.Timeout, params: { tool: "stay.current" } })
        partner.invoke.mockRejectedValueOnce(timeout).mockRejectedValueOnce(new Error("boom"))
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(EXPECTED.readTimeout)
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(EXPECTED.readFailure)
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual(EXPECTED.failedReadOutcomes)
        expect(logger.error).toHaveBeenCalledWith(ToolsLogEvent.CallFailed, timeout, EXPECTED.failedReadContext)
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

describe("ToolRegistryService.call writes that time out", () => {
    const timeout = () => new ToolsError({ code: ToolsErrorCode.Timeout, params: { tool: "booking.hold" } })

    it("sends a write with its replay key once more and answers what the server stored", async () => {
        const { gateway, partner, callLog } = await build()
        partner.invoke.mockRejectedValueOnce(timeout()).mockResolvedValueOnce({ holdId: "h1" })
        const step: ToolCaller = approved({ ...CALLER, workItemId: "item-1" })
        await expect(gateway.call(step, "hakuen.booking.hold", { roomType: "deluxe" })).resolves.toEqual(gwt.HELD_REPLY)
        const [first, second] = partner.invoke.mock.calls.map(([, , args]) => args)
        expect(second).toEqual(first)
        expect(first?.idempotencyKey).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(linesOf(callLog).map((line) => line.outcome)).toEqual(["ok"])
    })

    it.each(gws.TIMED_OUT_WRITES)("keeps the unknown outcome for $label", async ({ tool, args, attempts }) => {
        const { gateway, partner, callLog, receipts } = await build()
        const caller = approved({ ...CALLER, opKey: "timed-out-write" })
        partner.invoke.mockRejectedValue(timeout())
        const first = await gateway.call(caller, tool, args)
        expect(first).toEqual(EXPECTED.unknownWriteOutcome)
        await expect(gateway.call(caller, tool, args)).resolves.toEqual(first)
        expect(partner.invoke).toHaveBeenCalledTimes(attempts)
        expect(receipts.run).toHaveBeenCalledTimes(2)
        // The second ask ran nothing: the receipt answered it with the kept unknown outcome, and that is audited as a replay.
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual([
            ...EXPECTED.unknownWriteOutcomes,
            ["error", "receipt_replay"],
        ])
    })

    it("does not send a failed write again when it did not time out", async () => {
        const { gateway, partner } = await build()
        partner.invoke.mockRejectedValue(new Error("refused"))
        await expect(
            gateway.call(approved({ ...CALLER, workItemId: "item-1" }), "hakuen.booking.hold", { roomType: "deluxe" }),
        ).resolves.toEqual({ ok: false, code: "unavailable", detail: "internal" })
        expect(partner.invoke).toHaveBeenCalledTimes(1)
    })
})

describe("ToolRegistryService breaker", () => {
    it("does not consume a write's operation key while its connector's breaker is open", async () => {
        const { gateway, partner, receipts, clock } = await build()
        await gws.openPartnerBreaker(gateway, partner)
        const caller = approved({ ...CALLER, opKey: "confirm-after-recovery" })
        await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(EXPECTED.circuitOpen)
        expect(receipts.run).not.toHaveBeenCalled()
        clock.advance(120_000)
        partner.invoke.mockResolvedValue({ bookingId: "b1" })
        await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(gwt.CONFIRMED_REPLY)
        expect(receipts.run).toHaveBeenCalledTimes(1)
        expect(partner.invoke).toHaveBeenCalledTimes(6)
    })

    it("does not take the half-open probe when it returns a stored write result", async () => {
        const { gateway, partner, clock } = await build()
        const caller = approved({ ...CALLER, opKey: "already-confirmed" })
        await gateway.call(caller, "hakuen.booking.confirm", {})
        await gws.openPartnerBreaker(gateway, partner)
        clock.advance(120_000)
        await expect(gateway.call(caller, "hakuen.booking.confirm", {})).resolves.toEqual(SAFE_REPLY)
        partner.invoke.mockResolvedValue({ stay: null })
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(gwt.CURRENT_STAY_REPLY)
        expect(partner.invoke).toHaveBeenCalledTimes(7)
    })

    it("opens after five failures of a connector, refuses it meanwhile and audits it, while another connector runs", async () => {
        const { gateway, partner, native, callLog } = await build({ grants: [grantOf(), grantOf({ tool: "nivo.tool.payment.*" })] })
        await gws.openPartnerBreaker(gateway, partner)
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toEqual(EXPECTED.circuitOpen)
        await expect(gateway.call(CALLER, "nivo.tool.payment.credit.list", {})).resolves.toMatchObject({ ok: true })
        await expect(
            gateway.call({ ...CALLER, workspaceId: "ws-2" }, "hakuen.stay.current", {}),
        ).resolves.toMatchObject({ detail: "internal" })
        expect(partner.invoke).toHaveBeenCalledTimes(6)
        expect(native.invoke).toHaveBeenCalledTimes(1)
        expect(linesOf(callLog)[5]).toMatchObject({ outcome: "circuit_open", errorCode: "unavailable" })
    })

    it("lets one probe through after the pause, refuses the others while it runs, and closes when it succeeds", async () => {
        const { gateway, partner, clock } = await build()
        await gws.openPartnerBreaker(gateway, partner)
        clock.advance(120_000)
        const answer = gws.pendingPartnerReplyOf(partner)
        const probe = gateway.call(CALLER, "hakuen.stay.current", {})
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toMatchObject({ detail: "circuit_open" })
        answer({ stay: null })
        await expect(probe).resolves.toEqual({ ok: true, value: { stay: null }, summary: '{"stay":null}' })
        partner.invoke.mockResolvedValue({ stay: null })
        await expect(gateway.call(CALLER, "hakuen.stay.current", {})).resolves.toMatchObject({ ok: true })
    })
})

describe("ToolRegistryService.call native connectors: a refusal its source classed business", () => {
    it("is audited as refused under its reason and answered as tool_error naming it; any other refusal stays an error", async () => {
        const { gateway, native, callLog } = await build({ grants: [grantOf({ tool: "nivo.tool.payment.*" })] })
        native.invoke
            .mockRejectedValueOnce(
                new ToolsError({
                    code: ToolsErrorCode.NativeRefused,
                    params: { reason: "other_lead", refusalClass: "business" },
                }),
            )
            .mockRejectedValueOnce(
                new ToolsError({
                    code: ToolsErrorCode.NativeRefused,
                    params: { reason: "not_connected", refusalClass: "infrastructure" },
                }),
            )

        await expect(gateway.call(CALLER, "nivo.tool.payment.credit.list", {})).resolves.toEqual({
            ok: false,
            code: "tool_error",
            detail: '{"error":"other_lead"}',
            refused: "other_lead",
            nativeRefusal: "other_lead",
        })
        await expect(gateway.call(CALLER, "nivo.tool.payment.credit.list", {})).resolves.toEqual({
            ok: false,
            code: "tool_error",
            detail: '{"error":"not_connected"}',
            nativeRefusal: "not_connected",
        })
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode])).toEqual([
            ["refused", "other_lead"],
            ["error", "tool_error"],
        ])
    })
})

describe("ToolRegistryService.call native connectors", () => {
    it.each(gws.INVALID_GATEWAY_ARGUMENTS)("rejects $label before grants or execution", async (scenario) => {
        const { gateway, native, partner, grants, timeout, callLog } = await build(scenario.setup)
        await expect(gateway.call(CALLER, scenario.tool, scenario.args)).resolves.toEqual(EXPECTED.invalidArguments)
        expect(grants.listOfAgent).not.toHaveBeenCalled()
        expect(native.invoke).not.toHaveBeenCalled()
        expect(partner.invoke).not.toHaveBeenCalled()
        expect(timeout.schedule).not.toHaveBeenCalled()
        expect(linesOf(callLog).map((line) => [line.outcome, line.errorCode, line.argsMaskedJson])).toEqual(
            scenario.audit,
        )
    })

    it("returns and audits invalid arguments without opening the connector's breaker or logging a server failure", async () => {
        const { gateway, native, callLog, logger } = await build({ grants: [grantOf({ tool: "nivo.tool.payment.*" })] })
        for (let attempt = 0; attempt < 6; attempt += 1) {
            await expect(gateway.call(CALLER, "nivo.tool.payment.credit.list", { limit: 51 })).resolves.toEqual(
                gw.refusalOf("invalid_arguments", "Invalid tool arguments"),
            )
        }
        await expect(gateway.call(CALLER, "nivo.tool.payment.credit.list", { limit: 1 })).resolves.toMatchObject({ ok: true })
        expect(native.invoke).toHaveBeenCalledTimes(1)
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "refused", errorCode: "invalid_arguments" })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("lets a valid probe run after an invalid native call during breaker recovery", async () => {
        const { gateway, native, clock } = await build({ grants: [grantOf({ tool: "nivo.tool.payment.*" })] })
        await gwt.openNativeGatewayBreaker(gateway, native, clock, CALLER)
        await expect(gateway.call(CALLER, "nivo.tool.payment.credit.list", { limit: 51 })).resolves.toMatchObject({
            code: "invalid_arguments",
        })
        native.invoke.mockResolvedValue({ transactions: [] })
        await expect(gateway.call(CALLER, "nivo.tool.payment.credit.list", { limit: 1 })).resolves.toMatchObject({ ok: true })
        expect(native.invoke).toHaveBeenCalledTimes(6)
    })
})

describe("ToolRegistryService the shape of a connector's answers (its manifest's mark)", () => {
    it("marks a value of a connector whose manifest declares `answers: envelope`, and no other connector's value", async () => {
        const name = "nivo.tool.payment.credit.list"
        const enveloped = await build(
            { grants: [grantOf({ tool: "nivo.tool.payment.*" })] },
            { ...gwt.OPEN_SEPAY_MANIFEST, answers: "envelope" },
        )
        enveloped.native.invoke.mockResolvedValue({ ok: true, status: 200, data: { transactions: [] } })
        await expect(enveloped.gateway.call(CALLER, name, { limit: 1 })).resolves.toEqual({
            ok: true,
            value: { ok: true, status: 200, data: { transactions: [] } },
            summary: expect.any(String),
            answers: "envelope",
        })

        const plain = await build({ grants: [grantOf({ tool: "nivo.tool.payment.*" })] })
        plain.native.invoke.mockResolvedValue({ ok: true, status: 200, data: { transactions: [] } })
        await expect(plain.gateway.call(CALLER, name, { limit: 1 })).resolves.not.toHaveProperty("answers")
    })
})

describe("ToolRegistryService internal-only tools", () => {
    it("keeps a customer conversation from the tool, audited before the adapter, and runs it outside one", async () => {
        const name = "nivo.tool.payment.credit.list"
        const { gateway, native, callLog } = await build(
            { grants: [grantOf({ tool: "nivo.tool.payment.*" })] },
            gwt.INTERNAL_SEPAY_MANIFEST,
        )
        await expect(gateway.call(CALLER, name, {})).resolves.toEqual(gw.refusalOf("internal_only", name))
        expect(native.invoke).not.toHaveBeenCalled()
        expect(linesOf(callLog)[0]).toMatchObject({ outcome: "refused", errorCode: "internal_only" })
        const outside = { ...CALLER, conversationId: null }
        await expect(gateway.call(outside, name, {})).resolves.toMatchObject({ ok: true })
    })
})

describe("ToolRegistryService tainted turns", () => {
    // The taint applies to a write that would otherwise run with no node in front of it: the engine's own caller (an outside write asks a
    // person anyway, and a step's node decides its own).
    it("asks a person for a write of a turn that read tainted text, until one approves it or the window ends", async () => {
        const { gateway, callLog, clock } = await build(
            { grants: [grantOf({ tool: "nivo.tool.payment.*" })] },
            gwt.TAINTING_MANIFEST,
        )
        await expect(gwt.taintedTurnOf(gateway, clock, { ...CALLER, engine: true })).resolves.toEqual(gwt.taintedTurnExpected)
        expect(linesOf(callLog).map((line) => line.errorCode)).toContain("tainted_input")
    })

    // FX4 (D-P11-5): the team-chat turn reads the brain (a tainting read) and then files a truth change. With no grant row the write
    // asked `outside_write`, and after the brain read it would ask `tainted_input`: a second person in front of the founder's own card.
    it("runs a write that only files a request (no grant row, after a tainting read in the same turn): no approval asked", async () => {
        const base = gwt.TAINTING_MANIFEST.tools[0]
        if (base === undefined) throw new Error("the tainting manifest names no tool")
        const manifest: ToolManifest = {
            ...gwt.TAINTING_MANIFEST,
            tools: [
                { ...base, name: "read", internalOnly: false, taints: true },
                { ...base, name: "propose", internalOnly: false, scope: "write", filesRequest: true },
                { ...base, name: "act", internalOnly: false, scope: "write" },
            ],
        }
        // Only the read holds a grant row: the two writes have none.
        const { gateway, native, callLog } = await build({ grants: [grantOf({ tool: "nivo.tool.payment.read", constraints: [] })] }, manifest)
        native.invoke.mockResolvedValue({ outcome: "filed" })
        const writer = { ...CALLER, opKey: "run-1:answer:tool:1" }

        await gateway.call(writer, "nivo.tool.payment.read", {})
        const proposed = await gateway.call(writer, "nivo.tool.payment.propose", {})
        const acted = await gateway.call(writer, "nivo.tool.payment.act", {})

        expect(proposed).toMatchObject({ ok: true, value: { outcome: "filed" } })
        expect(acted).toEqual({ ok: false, code: "approval_required", reason: "outside_write" })
        expect(linesOf(callLog).map((line) => [line.tool, line.outcome, line.errorCode])).toEqual([
            ["nivo.tool.payment.read", "ok", null],
            ["nivo.tool.payment.propose", "ok", null],
            ["nivo.tool.payment.act", "approval", "outside_write"],
        ])
    })
})

/** A NIVO effect tool as the effect adapter declares it: a write granted by a step's allow-list, kept by the effect ledger. */
const EFFECT_MANIFEST: ToolManifest = {
    key: "order",
    namespace: "nivo.tool.order",
    name: "NIVO order",
    contractVersion: "nivo-effects@1",
    timeoutMs: 15_000,
    tools: [
        {
            name: "create",
            description: "NIVO business action nivo.tool.order.create",
            scope: "write",
            defaultMode: "ask",
            inputSchema: { type: "object" },
            argumentSchema: toolArgumentsSchema,
            ledgered: true,
            stepGranted: true,
            taintExempt: true,
        },
    ],
}

/** The graph step of the effect specs: a customer's turn whose allow-list holds the effect tool. */
const STEP_RUN: ToolRun = {
    turnId: "run-1",
    locale: "vi",
    origin: "customer",
    memberId: null,
    handedOffBy: null,
    leadId: null,
    stepTools: ["nivo.tool.order.create"],
}

/** A caller in that graph step, as the node door states it: the road `node` and the step's node. */
const STEP_CALLER: ToolCaller = {
    ...CALLER,
    opKey: "run-1:step-2:tool:0",
    turnId: "run-1",
    run: STEP_RUN,
    origin: "node",
    node: STEP_NODE,
}

describe("ToolRegistryService NIVO effect tools", () => {
    it("runs an effect tool on the step's allow-list with no grant row, past the receipts, under the manifest's limit", async () => {
        const { gateway, native, receipts } = await build({ grants: [] }, EFFECT_MANIFEST, [], null, AUTO_NODE)
        native.invoke.mockResolvedValue({ kind: "order", id: "o-1", facts: { amountVnd: 120_000 } })

        const result = await gateway.call(STEP_CALLER, "nivo.tool.order.create", { leadId: "lead-1" })

        expect(result).toEqual({ ok: true, value: { kind: "order", id: "o-1", facts: { amountVnd: 120_000 } }, summary: expect.any(String) })
        expect(receipts.run).not.toHaveBeenCalled()
        // The native caller carries the turn the call runs in (`NativeCaller.turnId`, what a declared job's turn is read from too).
        expect(native.invoke).toHaveBeenCalledWith("ws-1", "create", { leadId: "lead-1" }, {
            agentId: "sales",
            conversationId: "conv-1",
            opKey: STEP_CALLER.opKey,
            turnId: STEP_CALLER.turnId,
            run: STEP_CALLER.run,
            origin: "node",
            node: STEP_NODE,
        })
        const [connector] = gateway.familiesOf()
        expect(connector?.timeoutMs).toBe(15_000)
    })

    it("refuses an effect tool the step did not declare: the step's allow-list holds what it may call", async () => {
        const { gateway, native } = await build({ grants: [] }, EFFECT_MANIFEST, [], null, AUTO_NODE)
        const caller: ToolCaller = { ...STEP_CALLER, run: { ...STEP_RUN, stepTools: [] } }

        await expect(gateway.call(caller, "nivo.tool.order.create", { leadId: "lead-1" })).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "nivo.tool.order.create",
        })
        expect(native.invoke).not.toHaveBeenCalled()
    })

    it("reads no grant row at a step: the node's mode decides, whatever an owner's row says", async () => {
        const { gateway, native, grants } = await build(
            { grants: [grantOf({ tool: "nivo.tool.order.*", mode: "ask", constraints: [] })] },
            EFFECT_MANIFEST,
            [],
            null,
            AUTO_NODE,
        )
        native.invoke.mockResolvedValue({ kind: "order", id: "o-1", facts: {} })

        await expect(gateway.call(STEP_CALLER, "nivo.tool.order.create", { leadId: "lead-1" })).resolves.toMatchObject({ ok: true })
        expect(grants.listOfAgent).not.toHaveBeenCalled()
    })

    it("answers a refusal fact as a value and audits it as refused with its reason", async () => {
        const { gateway, native, callLog } = await build({ grants: [] }, EFFECT_MANIFEST, [], null, AUTO_NODE)
        native.invoke.mockResolvedValue({ kind: "refused", id: "item_unknown", facts: { name: PEACH_TEA_VI } })

        const result = await gateway.call(STEP_CALLER, "nivo.tool.order.create", { leadId: "lead-1" })

        assert(result.ok)
        expect(result.value).toEqual({ kind: "refused", id: "item_unknown", facts: { name: PEACH_TEA_VI } })
        expect(linesOf(callLog).at(-1)).toMatchObject({ tool: "nivo.tool.order.create", outcome: "refused", errorCode: "item_unknown" })
    })

    it("still refuses an effect tool called with no step key", async () => {
        const { gateway, native } = await build({ grants: [] }, EFFECT_MANIFEST, [], null, AUTO_NODE)
        const caller: ToolCaller = { ...STEP_CALLER, opKey: undefined }

        await expect(gateway.call(caller, "nivo.tool.order.create", { leadId: "lead-1" })).resolves.toEqual({
            ok: false,
            code: "idempotency_key_required",
            detail: "nivo.tool.order.create",
        })
        expect(native.invoke).not.toHaveBeenCalled()
    })
})

// The step's node declares ONE mode (nivo-frame `rights`): `ask` asks, `auto` runs, and a node that states none (or cannot be read)
// refuses: the engine has no default.
describe("ToolRegistryService NIVO effect tools > the mode the step's node states", () => {
    it("holds the mode the node states: ask asks (ask_mode), auto runs, and a person's approval of the call runs it", async () => {
        const asks = await build({ grants: [] }, EFFECT_MANIFEST, [], null, requestsOf(nodeOf("ask")))
        await expect(asks.gateway.call(STEP_CALLER, "nivo.tool.order.create", { leadId: "lead-1" })).resolves.toEqual({
            ok: false,
            code: "approval_required",
            reason: "ask_mode",
        })
        expect(asks.native.invoke).not.toHaveBeenCalled()
        asks.native.invoke.mockResolvedValue({ kind: "order", id: "o-1", facts: {} })
        await expect(
            asks.gateway.call(approved(STEP_CALLER), "nivo.tool.order.create", { leadId: "lead-1" }),
        ).resolves.toMatchObject({ ok: true })

        const runs = await build({ grants: [] }, EFFECT_MANIFEST, [], null, AUTO_NODE)
        runs.native.invoke.mockResolvedValue({ kind: "order", id: "o-1", facts: {} })
        await expect(runs.gateway.call(STEP_CALLER, "nivo.tool.order.create", { leadId: "lead-1" })).resolves.toMatchObject({ ok: true })
    })

    it("refuses a write of a node that states no mode (node_mode_unknown), and audits it", async () => {
        const { gateway, native, callLog } = await build({ grants: [] }, EFFECT_MANIFEST, [], null, requestsOf(null))

        await expect(gateway.call(STEP_CALLER, "nivo.tool.order.create", { leadId: "lead-1" })).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "node_mode_unknown",
        })
        expect(native.invoke).not.toHaveBeenCalled()
        expect(linesOf(callLog).at(-1)).toMatchObject({ outcome: "refused", errorCode: "node_mode_unknown" })
    })

    it("never asks a read, even under an ask node or one that states no mode", async () => {
        const reading = { ...STEP_CALLER, run: { ...STEP_RUN, stepTools: ["nivo.tool.payment.credit.list"] } }
        for (const request of [nodeOf("ask"), null]) {
            const { gateway } = await build({ grants: [] }, gwt.OPEN_SEPAY_MANIFEST, [], null, requestsOf(request))
            await expect(gateway.call(reading, "nivo.tool.payment.credit.list", {})).resolves.toMatchObject({ ok: true })
        }
    })
})

/** The attachment of the spec agent to its SePay account (agent + connection + provider: nothing more). */
const SEPAY_ROW: ProviderAttachmentView = { agentId: "sales", connectionId: "conn-mb", provider: "sepay" }

/**
 * A write tool of the payment provider the NODE places (no catalogue provider serves it). Ledger (TOOLS-LEAD 2026-11-13): this stand-in was
 * `payment.transfer.create`; that tool is now a READ of the `sepay` catalogue (`transfer.instruction`: it creates and moves nothing), and a
 * read never asks, so the write cases use another id.
 */
const QR_MANIFEST: ToolManifest = {
    ...EFFECT_MANIFEST,
    key: "payment",
    namespace: "nivo.tool.payment",
    tools: EFFECT_MANIFEST.tools.slice(0, 1).map((tool) => ({ ...tool, name: "refund.create" })),
}
const QR_CALLER: ToolCaller = { ...STEP_CALLER, run: { ...STEP_RUN, stepTools: ["nivo.tool.payment.refund.create"] } }

/** The SePay node of the provider cases, read for the step. */
const SEPAY_NODE = (mode: NodeMode): NodeRequestsGate =>
    requestsOf({ mode, accounts: [{ kind: "payment", provider: "sepay", connectionId: null }] })

/** A provider WRITE served by Google (the ledger), declared by the step, on a node of the given mode. */
const LEDGER_WRITE = "nivo.tool.ledger.entry.append"
const LEDGER_MANIFEST: ToolManifest = {
    ...EFFECT_MANIFEST,
    key: "ledger",
    namespace: "nivo.tool.ledger",
    tools: EFFECT_MANIFEST.tools.slice(0, 1).map((tool) => ({ ...tool, name: "entry.append" })),
}
const LEDGER_ROW: ProviderAttachmentView = { agentId: "sales", connectionId: "conn-sheet", provider: "google" }
const LEDGER_CALLER: ToolCaller = { ...STEP_CALLER, run: { ...STEP_RUN, stepTools: [LEDGER_WRITE] } }
const BOOKS_NODE = (mode: NodeMode): NodeRequestsGate =>
    requestsOf({ mode, accounts: [{ kind: "books", provider: "google", connectionId: null }] })

/** A provider READ served by SePay, declared by the step. */
const CREDIT_LIST = "nivo.tool.payment.credit.list"
const READING_CALLER: ToolCaller = { ...STEP_CALLER, run: { ...STEP_RUN, stepTools: [CREDIT_LIST] } }

describe("ToolRegistryService rights (nivo-frame `rights`): node declared? → attached? → mode", () => {
    it("refuses a tool the step's node did not declare, before any attachment is read", async () => {
        const { gateway, native, access } = await build({ grants: [] }, LEDGER_MANIFEST, [], [LEDGER_ROW], BOOKS_NODE("auto"))
        const undeclared: ToolCaller = { ...STEP_CALLER, run: { ...STEP_RUN, stepTools: [] } }

        await expect(gateway.call(undeclared, LEDGER_WRITE, { entry: "e-1" })).resolves.toEqual(gw.refusalOf("not_granted", LEDGER_WRITE))
        expect(native.invoke).not.toHaveBeenCalled()
        expect(access.listOfAgent).not.toHaveBeenCalled()
    })

    it("refuses a declared provider tool when the agent holds no attached account of a provider serving it (not_attached)", async () => {
        const { gateway, native, callLog } = await build({ grants: [] }, LEDGER_MANIFEST, [], [SEPAY_ROW], BOOKS_NODE("auto"))

        await expect(gateway.call(LEDGER_CALLER, LEDGER_WRITE, { entry: "e-1" })).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "not_attached",
        })
        expect(native.invoke).not.toHaveBeenCalled()
        expect(linesOf(callLog).at(-1)).toMatchObject({ outcome: "refused", errorCode: "not_attached" })
    })

    it("runs a declared provider write on an attached account under an `auto` node", async () => {
        const { gateway, native } = await build({ grants: [] }, LEDGER_MANIFEST, [], [LEDGER_ROW], BOOKS_NODE("auto"))
        native.invoke.mockResolvedValue({ kind: "entry", id: "e-1" })

        await expect(gateway.call(LEDGER_CALLER, LEDGER_WRITE, { entry: "e-1" })).resolves.toMatchObject({ ok: true })
        expect(native.invoke).toHaveBeenCalled()
    })

    it("asks a person for a declared provider write on an attached account under an `ask` node, and runs it once approved", async () => {
        const { gateway, native } = await build({ grants: [] }, LEDGER_MANIFEST, [], [LEDGER_ROW], BOOKS_NODE("ask"))
        native.invoke.mockResolvedValue({ kind: "entry", id: "e-1" })

        await expect(gateway.call(LEDGER_CALLER, LEDGER_WRITE, { entry: "e-1" })).resolves.toEqual({
            ok: false,
            code: "approval_required",
            reason: "ask_mode",
        })
        expect(native.invoke).not.toHaveBeenCalled()
        await expect(gateway.call({ ...LEDGER_CALLER, approvedBy: "owner-1" }, LEDGER_WRITE, { entry: "e-1" })).resolves.toMatchObject({
            ok: true,
        })
    })

    it("refuses an `ask` node's write when the agent is detached: the kill switch wins over the ask", async () => {
        const { gateway, native } = await build({ grants: [] }, LEDGER_MANIFEST, [], [], BOOKS_NODE("ask"))

        await expect(gateway.call(LEDGER_CALLER, LEDGER_WRITE, { entry: "e-1" })).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "not_attached",
        })
        expect(native.invoke).not.toHaveBeenCalled()
    })

    it("runs a declared provider read under an `ask` node: a read never asks", async () => {
        const { gateway, native } = await build({ grants: [] }, gwt.OPEN_SEPAY_MANIFEST, [], [SEPAY_ROW], SEPAY_NODE("ask"))

        await expect(gateway.call(READING_CALLER, CREDIT_LIST, {})).resolves.toMatchObject({ ok: true })
        expect(native.invoke).toHaveBeenCalled()
    })

    it("asks for a write outside every node (`approval_required`, `outside_write`), attached or not of a row", async () => {
        const { gateway, native } = await build({ grants: [] }, LEDGER_MANIFEST, [], [LEDGER_ROW])

        await expect(gateway.call(CALLER, LEDGER_WRITE, { entry: "e-1" })).resolves.toEqual({
            ok: false,
            code: "approval_required",
            reason: "outside_write",
        })
        expect(native.invoke).not.toHaveBeenCalled()
    })

    it("detach kills: the same declared call that ran on the attachment is refused not_attached once it is gone", async () => {
        const attached = await build({ grants: [] }, LEDGER_MANIFEST, [], [LEDGER_ROW], BOOKS_NODE("auto"))
        attached.native.invoke.mockResolvedValue({ kind: "entry", id: "e-1" })
        await expect(attached.gateway.call(LEDGER_CALLER, LEDGER_WRITE, { entry: "e-1" })).resolves.toMatchObject({ ok: true })

        attached.access.listOfAgent.mockResolvedValue([])
        await expect(attached.gateway.call(LEDGER_CALLER, LEDGER_WRITE, { entry: "e-2" })).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "not_attached",
        })
    })
})

describe("ToolRegistryService rights: the other roads and tools", () => {
    it("a node-placed write (no catalogue provider) reads no attachment: its node's mode alone decides", async () => {
        const auto = await build({ grants: [] }, QR_MANIFEST, [], [], SEPAY_NODE("auto"))
        auto.native.invoke.mockResolvedValue({ kind: "message", id: "m-1" })
        await expect(auto.gateway.call(QR_CALLER, "nivo.tool.payment.refund.create", { orderId: "o-1" })).resolves.toMatchObject({ ok: true })
        expect(auto.access.listOfAgent).not.toHaveBeenCalled()

        const ask = await build({ grants: [] }, QR_MANIFEST, [], [], SEPAY_NODE("ask"))
        await expect(ask.gateway.call(QR_CALLER, "nivo.tool.payment.refund.create", { orderId: "o-1" })).resolves.toEqual({
            ok: false,
            code: "approval_required",
            reason: "ask_mode",
        })
    })

    it("the engine's own caller (a module's declared job) needs no grant row: it runs once attached", async () => {
        const detached = await build({ grants: [] }, gwt.OPEN_SEPAY_MANIFEST, [], [])
        await expect(detached.gateway.call({ ...CALLER, engine: true }, CREDIT_LIST, {})).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "not_attached",
        })

        const attached = await build({ grants: [] }, gwt.OPEN_SEPAY_MANIFEST, [], [SEPAY_ROW])
        await expect(attached.gateway.call({ ...CALLER, engine: true }, CREDIT_LIST, {})).resolves.toMatchObject({ ok: true })
        expect(attached.grants.listOfAgent).not.toHaveBeenCalled()
    })

    it("a read outside every node needs its grant row (the outside allow-list) and the attachment", async () => {
        const unlisted = await build({ grants: [] }, gwt.OPEN_SEPAY_MANIFEST, [], [SEPAY_ROW])
        await expect(unlisted.gateway.call(CALLER, CREDIT_LIST, {})).resolves.toEqual(gw.refusalOf("not_granted", CREDIT_LIST))

        const listed = await build({ grants: [grantOf({ tool: "nivo.tool.payment.*" })] }, gwt.OPEN_SEPAY_MANIFEST, [], [SEPAY_ROW])
        await expect(listed.gateway.call(CALLER, CREDIT_LIST, {})).resolves.toMatchObject({ ok: true })

        const detached = await build({ grants: [grantOf({ tool: "nivo.tool.payment.*" })] }, gwt.OPEN_SEPAY_MANIFEST, [], [])
        await expect(detached.gateway.call(CALLER, CREDIT_LIST, {})).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "not_attached",
        })
    })

    it("names the agents attached to an account serving the tool beside those holding a grant row", async () => {
        const { gateway, grants } = await build({}, gwt.OPEN_SEPAY_MANIFEST, [], [SEPAY_ROW])
        grants.agentsGranted.mockResolvedValue(["a1"])

        await expect(gateway.agentsGranted("ws-1", [CREDIT_LIST])).resolves.toEqual(["sales", "a1"])
    })
})

describe("ToolRegistryService truth reads (owner order 2026-11-11 item 4: what an agent read is recorded)", () => {
    const readingManifest = (): ToolManifest => {
        const base = gwt.TAINTING_MANIFEST.tools[0]
        if (base === undefined) throw new Error("the tainting manifest names no tool")
        return {
            ...gwt.TAINTING_MANIFEST,
            tools: [
                { ...base, name: "read", internalOnly: false, readsTruths: true },
                { ...base, name: "peek", internalOnly: false },
            ],
        }
    }

    it("keeps the truths a truth-graph read served, ids and versions only, with the run of the call", async () => {
        const { gateway, native, callLog } = await build({ grants: [grantOf({ tool: "nivo.tool.payment.*", constraints: [] })] }, readingManifest())
        native.invoke.mockResolvedValue({
            notice: "data",
            facts: [
                { id: "f1", value: "30.000", v: 2 },
                { id: "f2", value: "8h" },
            ],
        })
        const caller = { ...CALLER, turnId: "run-7" }

        await expect(gateway.call(caller, "nivo.tool.payment.read", {})).resolves.toMatchObject({ ok: true })
        await expect(gateway.call(caller, "nivo.tool.payment.peek", {})).resolves.toMatchObject({ ok: true })

        const [read, peek] = linesOf(callLog)
        expect(read).toMatchObject({
            runId: "run-7",
            factReads: [
                { factId: "f1", version: 2 },
                { factId: "f2", version: null },
            ],
        })
        // Any other tool keeps no reads; the run is kept for every call made in one.
        expect(peek).toMatchObject({ runId: "run-7", factReads: null })
    })
})

describe("ToolRegistryService where a call came from: the audit, and the account the runner handed", () => {
    const NODE = { nodeKey: "match", versionId: "v-3", workflowId: "wf-1" }
    const LISTED = { grants: [grantOf({ tool: "nivo.tool.payment.*" })] }

    it("writes the road and the workflow step of the caller on the audit line, and nulls for a caller that states none", async () => {
        const reading: ToolCaller = { ...CALLER, origin: "node", node: NODE, run: { ...STEP_RUN, stepTools: [CREDIT_LIST] } }
        const { gateway, callLog } = await build(LISTED, gwt.OPEN_SEPAY_MANIFEST, [], [SEPAY_ROW], AUTO_NODE)

        await gateway.call(reading, CREDIT_LIST, {})
        await gateway.call({ ...CALLER, origin: "document_reader" }, CREDIT_LIST, {})
        await gateway.call(CALLER, CREDIT_LIST, {})

        expect(
            linesOf(callLog).map((line) => [line.originKind, line.nodeKey, line.workflowId, line.workflowVersionId, line.outcome]),
        ).toEqual([
            ["node", "match", "wf-1", "v-3", "ok"],
            ["document_reader", null, null, null, "ok"],
            [null, null, null, null, "ok"],
        ])
    })

    it("judges the attachment of a call with no account handed over every serving account", async () => {
        const { gateway } = await build(LISTED, gwt.OPEN_SEPAY_MANIFEST, [], [SEPAY_ROW])
        const attachment = jest.spyOn(AgentAccountsService.prototype, "attachmentOf")

        await gateway.call(CALLER, CREDIT_LIST, {})

        expect(attachment.mock.calls.map((call) => call.slice(2))).toEqual([[CREDIT_LIST, {}]])
        attachment.mockRestore()
    })

    it("judges a call on the account the tool runner handed it alone, and names that account on the audit line", async () => {
        const { gateway, callLog } = await build(LISTED, gwt.OPEN_SEPAY_MANIFEST, [], [SEPAY_ROW])
        const attachment = jest.spyOn(AgentAccountsService.prototype, "attachmentOf")
        const handed: ToolCaller = {
            ...CALLER,
            connectionId: "other-account",
            provider: "sepay",
            attempt: 1,
            chosenBy: "order",
        }

        const answer = await gateway.call(handed, CREDIT_LIST, {})

        expect(attachment.mock.calls[0]?.[3]).toEqual({ connectionId: "other-account", provider: "sepay" })
        expect(answer).toEqual({ ok: false, code: "not_granted", detail: "not_attached" })
        expect(linesOf(callLog).at(-1)).toMatchObject({
            connectionId: "other-account",
            provider: "sepay",
            attempt: 1,
            chosenBy: "order",
        })
        attachment.mockRestore()
    })
})

/** A tool answered per provider, as the connection status declares it: internal, a part for the bank feed, Zalo OA and Telegram. */
const PARTED_MANIFEST: ToolManifest = {
    key: "connection",
    namespace: "nivo.tool.connection",
    name: "NIVO connections",
    contractVersion: "connection-native@1",
    tools: [
        {
            name: "status.get",
            description: "Status.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: { type: "object" },
            argumentSchema: toolArgumentsSchema,
            internalOnly: true,
            providerParts: ["sepay", "zalo_oa", "telegram"],
        },
    ],
}
const STATUS = "nivo.tool.connection.status.get"
const INSIDE: ToolCaller = { ...CALLER, conversationId: null }
const STATUS_GRANT = grantOf({ tool: STATUS, constraints: [] })

/** The parts the adapter was handed on its last call. */
const partsHanded = (native: jest.Mocked<NativeToolFamily>): unknown => native.invoke.mock.calls.at(-1)?.[3].parts

describe("ToolRegistryService a tool answered per provider: each part on its own provider's attachment", () => {
    it("a granted caller attached to no bank feed: the Zalo OA and Telegram parts run, the bank part is left out", async () => {
        const { gateway, native } = await build({ grants: [STATUS_GRANT] }, PARTED_MANIFEST, [], [])

        await expect(gateway.call(INSIDE, STATUS, {})).resolves.toMatchObject({ ok: true })

        expect(partsHanded(native)).toEqual([{ provider: "zalo_oa" }, { provider: "telegram" }])
    })

    it("a granted caller attached to the bank feed: every part runs", async () => {
        const { gateway, native } = await build({ grants: [STATUS_GRANT] }, PARTED_MANIFEST, [], [SEPAY_ROW])

        await expect(gateway.call(INSIDE, STATUS, {})).resolves.toMatchObject({ ok: true })

        expect(partsHanded(native)).toEqual([{ provider: "sepay" }, { provider: "zalo_oa" }, { provider: "telegram" }])
    })

    it("a named provider is judged on its own: the bank part not_attached, a Zalo OA part with no grant row refused", async () => {
        const { gateway, native, callLog } = await build({ grants: [] }, PARTED_MANIFEST, [], [])

        await expect(gateway.call(INSIDE, STATUS, { provider: "sepay" })).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: STATUS,
        })
        expect(linesOf(callLog).at(-1)).toMatchObject({ outcome: "refused", errorCode: "not_granted" })
        await expect(gateway.call(INSIDE, STATUS, { provider: "zalo_oa" })).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: STATUS,
        })
        expect(native.invoke).not.toHaveBeenCalled()

        const granted = await build({ grants: [STATUS_GRANT] }, PARTED_MANIFEST, [], [])
        await expect(granted.gateway.call(INSIDE, STATUS, { provider: "sepay" })).resolves.toEqual({
            ok: false,
            code: "not_granted",
            detail: "not_attached",
        })
    })

    it("the engine's own caller sees every part with no grant row, the bank part only on its attachment", async () => {
        const attached = await build({ grants: [] }, PARTED_MANIFEST, [], [SEPAY_ROW])
        await expect(attached.gateway.call({ ...INSIDE, engine: true }, STATUS, {})).resolves.toMatchObject({ ok: true })
        expect(partsHanded(attached.native)).toEqual([{ provider: "sepay" }, { provider: "zalo_oa" }, { provider: "telegram" }])

        const detached = await build({ grants: [] }, PARTED_MANIFEST, [], [])
        await expect(detached.gateway.call({ ...INSIDE, engine: true }, STATUS, {})).resolves.toMatchObject({ ok: true })
        expect(partsHanded(detached.native)).toEqual([{ provider: "zalo_oa" }, { provider: "telegram" }])
    })
})

// #10a: the gateway carries the typed reason of a native refusal on its answer, so the node door decides "never sent" on it.
describe("ToolRegistryService.call native connectors: the typed reason of a refusal rides on the answer", () => {
    it("names the reason of an infrastructure refusal (not_connected) as `nativeRefusal`", async () => {
        const { gateway, native } = await build({ grants: [grantOf({ tool: "nivo.tool.payment.*" })] })
        native.invoke.mockRejectedValueOnce(
            new ToolsError({
                code: ToolsErrorCode.NativeRefused,
                params: { reason: "not_connected", refusalClass: "infrastructure" },
            }),
        )

        await expect(gateway.call(CALLER, "nivo.tool.payment.credit.list", {})).resolves.toMatchObject({
            ok: false,
            code: "tool_error",
            nativeRefusal: "not_connected",
        })
    })
})
