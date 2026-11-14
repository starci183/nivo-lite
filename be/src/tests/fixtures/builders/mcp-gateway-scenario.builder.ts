import { TOOL } from "@nivo-lite/agent-sdk/names"
import type {
    MissingWriteIdentitiesShape,
    TimedOutWritesShape,
    GatewayScenarioExpectedShape,
    InvalidGatewayToolsShape,
    InvalidGatewayArgumentsShape,
} from "./mcp-gateway-scenario-shapes.builder"
import type { MockOf } from "@starci/jest-preset"
import type { CallLogLine, ToolCallLogService } from "@modules/domain/tool-call-log"
import {
    type ToolCaller,
    type ToolCallResult,
    type ToolJson,
    type ToolRegistryService,
    type ToolManifest,
    type NativeToolFamily,
    ToolsError,
    ToolsErrorCode,
    SEPAY_MANIFEST,
} from "@modules/domain/tools"
import type { ToolReceiptsService } from "@modules/domain/tool-receipts"
import type { ToolGrantsService } from "@modules/domain/tool-grants"
import { eachInOrder } from "@modules/platform/primitives"
import type { QueueTimeout } from "@modules/platform/queue"
import {
    GATEWAY_CALLER,
    HAKUEN_MANIFEST,
    hakuenToolOf,
    roleProvidersOf,
    toolGrantRowOf,
    type GatewaySpecSetup,
} from "./mcp-gateway.builder"

/** The typed constructor doubles whose deterministic defaults one gateway scenario arranges. */
interface GatewayScenarioDoubles {
    /** The deadline scheduler. */
    readonly timeout: MockOf<QueueTimeout>
    /** The cancellation function created by the spec's scheduler double. */
    readonly cancel: () => void
    /** The agent's tool grants. */
    readonly grants: MockOf<ToolGrantsService>
    /** The stored outcomes of side-effect calls. */
    readonly receipts: MockOf<ToolReceiptsService>
}

/** Configures constructor doubles while the spec keeps the actual Nest module and every token binding. */
export const arrangeGatewayScenario = (setup: GatewaySpecSetup, doubles: GatewayScenarioDoubles): void => {
    doubles.timeout.schedule.mockReturnValue(doubles.cancel)
    doubles.grants.listOfAgent.mockResolvedValue(setup.grants ?? [toolGrantRowOf()])
    doubles.grants.agentsGranted.mockResolvedValue(["a1", "a2"])
    const results = new Map<string, Promise<ToolCallResult>>()
    doubles.receipts.run.mockImplementation((workspaceId, key, operation) => {
        const identity = JSON.stringify([workspaceId, key])
        const previous = results.get(identity)
        if (previous !== undefined) return previous
        const result = operation()
        results.set(identity, result)
        return result
    })
}

/** The audit lines written, in order. */
export const gatewayLinesOf = (callLog: MockOf<ToolCallLogService>): ReadonlyArray<CallLogLine> =>
    callLog.append.mock.calls.map(([line]) => line)

/** A partner family whose receivable lookup is a write that plays `receivable.find`, to exercise the operation identity guard. */
export const WRITE_ROLE_MANIFEST: ToolManifest = {
    key: "pay",
    name: "Pay Gateway",
    contractVersion: "pay-native@1",
    tools: [hakuenToolOf("receivable.lookup", "Find a receivable.", false, { role: "receivable.find" })],
}

/** The partner family of the registry scenario: HAKUEN declaring a per-call limit below the engine's floor. */
const FAST_HAKUEN_MANIFEST: ToolManifest = { ...HAKUEN_MANIFEST, timeoutMs: 10 }

/** Missing or blank operation identities, including an explicit blank that must not fall back to a work item. */
export const MISSING_WRITE_IDENTITIES: ReadonlyArray<MissingWriteIdentitiesShape> = [
    { label: "absent operation and work item", caller: { ...GATEWAY_CALLER, workItemId: null }, native: false },
    {
        label: "empty operation with a work item",
        caller: { ...GATEWAY_CALLER, opKey: "", workItemId: "item-1" },
        native: false,
    },
    {
        label: "whitespace operation with a work item",
        caller: { ...GATEWAY_CALLER, opKey: " \t ", workItemId: "item-1" },
        native: false,
    },
    {
        label: "blank work item fallback",
        caller: { ...GATEWAY_CALLER, opKey: undefined, workItemId: " " },
        native: false,
    },
    { label: "native write without identity", caller: { ...GATEWAY_CALLER, workItemId: null }, native: true },
]

/** A work-item fallback and an explicit operation key both provide the stable identity for a claimed write. */
export const VALID_WRITE_IDENTITIES: ReadonlyArray<ToolCaller> = [
    { ...GATEWAY_CALLER, opKey: undefined, workItemId: "item-1" },
    { ...GATEWAY_CALLER, opKey: "message-1", workItemId: " " },
]

/** Provider-call counts for one timed-out write, before its client retries the stored outcome. */
export const TIMED_OUT_WRITES: ReadonlyArray<TimedOutWritesShape> = [
    { label: "a generated replay key", tool: "hakuen.booking.hold", args: { roomType: "deluxe" }, attempts: 2 },
    { label: "a tool without a replay field", tool: "hakuen.booking.confirm", args: { holdId: "h1" }, attempts: 1 },
    {
        label: "a nonblank caller key",
        tool: "hakuen.booking.hold",
        args: { roomType: "deluxe", idempotencyKey: "mine" },
        attempts: 2,
    },
    ...[
        { label: "a null caller key", value: null },
        { label: "an empty caller key", value: "" },
        { label: "a whitespace caller key", value: " \t " },
        { label: "a numeric caller key", value: 7 },
        { label: "a boolean caller key", value: false },
        { label: "an array caller key", value: ["key"] },
        { label: "an object caller key", value: { key: "value" } },
    ].map(({ label, value }) => ({
        label,
        tool: "hakuen.booking.hold",
        args: { roomType: "deluxe", idempotencyKey: value },
        attempts: 1,
    })),
]

type GatewayScenario = "registry" | "discovery" | "description" | "approval" | "missing-identity"

/** Fresh connector and grant data for the gateway's registry, role and admission scenarios. */
export const gatewayScenarioOf = (scenario: GatewayScenario): GatewaySpecSetup => {
    switch (scenario) {
        case "registry":
            return { families: [FAST_HAKUEN_MANIFEST] }
        case "discovery":
            return { grants: [toolGrantRowOf(), toolGrantRowOf({ tool: "nivo.tool.payment.*" })] }
        case "description":
            return { grants: [toolGrantRowOf(), toolGrantRowOf({ tool: "hakuen.keycode.reveal", mode: "never" })] }
        case "approval":
            return {
                grants: [
                    toolGrantRowOf(),
                    toolGrantRowOf({ tool: "hakuen.booking.cancel", mode: "ask", constraints: [] }),
                ],
            }
        case "missing-identity":
            return {
                families: [WRITE_ROLE_MANIFEST],
                grants: [
                    toolGrantRowOf({ tool: "pay.*", constraints: [] }),
                    toolGrantRowOf({ tool: "nivo.tool.payment.*", constraints: [] }),
                ],
            }
    }
}

/** A replacement speaker serves the same operation without inheriting its former conversation routing. */
export const reroutedCallerOf = (caller: ToolCaller): ToolCaller => ({
    ...caller,
    agentId: "replacement-agent",
    conversationId: null,
})

/** Fixed public values expected by the gateway scenarios, independent of the subject's implementation. */
export const GATEWAY_SCENARIO_EXPECTED: GatewayScenarioExpectedShape = {
    nativeUnknownTool: new ToolsError({
        code: ToolsErrorCode.UnknownTool,
        params: { tool: "transactions.list" },
    }),
    invalidArguments: { ok: false, code: "invalid_arguments", detail: "Invalid tool arguments" },
    connectorStates: [
        ["sepay", 4000],
        ["hakuen", 500],
    ],
    reply: { ok: true, value: { holdId: "h1", code: "777" } },
    held: { ok: true, value: { holdId: "h1" } },
    native: { ok: true, value: { transactions: [] } },
    toolRefusal: {
        ok: false,
        code: "tool_error",
        detail: '{"error":"NO_AVAILABILITY"}',
        nativeRefusal: "NO_AVAILABILITY",
    },
    readTimeout: { ok: false, code: "unavailable", detail: ToolsErrorCode.Timeout },
    readFailure: { ok: false, code: "unavailable", detail: "internal" },
    circuitOpen: { ok: false, code: "unavailable", detail: "circuit_open" },
    readyRoles: {
        ready: true,
        missing: [],
        providers: roleProvidersOf({
            "identity.find": ["HAKUEN"],
            "payment.credits.list": ["SePay"],
            "payment.debits.list": ["SePay"],
        }),
    },
    askModeRefusal: { ok: false, code: "approval_required", reason: "ask_mode" },
    approvalOutcomes: [
        ["approval", "ask_mode"],
        ["approval", "over_constraint"],
    ],
    retriedAnswers: [
        { ok: true, value: { holdId: "h1", code: "777" } },
        { ok: true, value: { holdId: "h1", code: "777" } },
    ],
    failedReadOutcomes: [
        ["timeout", ToolsErrorCode.Timeout],
        ["error", "internal"],
    ],
    unknownWriteOutcomes: [["timeout", "unknown_outcome"]],
    unknownWriteOutcome: { ok: false, code: "unknown_outcome", detail: ToolsErrorCode.Timeout },
    grants: [{ tool: "hakuen.*", mode: "auto", limitVnd: null, constraints: [{ arg: "discountPct", max: 10 }] }],
    creditsRole: {
        ok: true,
        tool: {
            role: "payment.credits.list",
            name: TOOL.paymentCreditList,
            connector: "sepay",
            connectorName: "SePay",
        },
    },
    identityRole: {
        ok: true,
        tool: {
            role: "identity.find",
            name: "hakuen.guest.findByChannelIdentity",
            connector: "hakuen",
            connectorName: "HAKUEN",
        },
    },
    missingReceivableRole: { ok: false, code: "no_capability", role: "receivable.find" },
    confirmation: {
        name: "hakuen.booking.confirm",
        description: "Confirm a held booking.",
        scope: "write",
        mode: "auto",
        inputSchema: { type: "object" },
        constraints: [{ arg: "discountPct", max: 10 }],
        limitVnd: null,
    },
    revealRequest: { name: "keycode.reveal", args: { stayId: "s1" } },
    revealedAudit: { outcome: "ok", errorCode: null, resultSummary: '{"holdId":"h1","code":"***"}' },
    failedReadContext: { workspaceId: "ws-1", connector: "hakuen", tool: "stay.current" },
}

/** A native read connector treated as a write to exercise the operation identity guard. */
export const WRITE_NATIVE_MANIFEST: ToolManifest = {
    ...SEPAY_MANIFEST,
    tools: SEPAY_MANIFEST.tools.map((tool) => ({ ...tool, scope: "write" as const, internalOnly: false })),
}

/** Five failed reads open the HAKUEN family's breaker. */
export const openPartnerBreaker = async (
    gateway: ToolRegistryService,
    partner: MockOf<NativeToolFamily>,
): Promise<void> => {
    partner.invoke.mockRejectedValue(new Error("down"))
    await eachInOrder([1, 2, 3, 4, 5], () => gateway.call(GATEWAY_CALLER, "hakuen.stay.current", {}))
}

/** Keeps one HAKUEN answer pending until the spec resolves its half-open probe. */
export const pendingPartnerReplyOf = (partner: MockOf<NativeToolFamily>): ((value: ToolJson) => void) => {
    const answers: Array<(value: ToolJson) => void> = []
    partner.invoke.mockReturnValueOnce(
        new Promise<ToolJson>((resolve) => {
            answers.push(resolve)
        }),
    )
    return (value: ToolJson): void => {
        for (const answer of answers) answer(value)
    }
}

/** Names refused before grants or an audit entry are consulted. */
export const INVALID_GATEWAY_TOOLS: Array<InvalidGatewayToolsShape> = [
    { name: "nope", answer: { ok: false, code: "invalid_name", detail: "nope" } },
    { name: "zalo.send", answer: { ok: false, code: "unknown_tool", detail: "zalo.send" } },
    { name: "hakuen.nope", answer: { ok: false, code: "unknown_tool", detail: "hakuen.nope" } },
]

/** Global budget failures stop before resolution; native shape failures stop before ask-mode grants. */
/** A record carrying an own `__proto__` key, as a JSON body read from the wire can. */
const prototypeKeyed = (): ToolJson => {
    const record: ToolJson = {}
    return Object.defineProperty(record, "__proto__", { value: { polluted: true }, enumerable: true })
}

/** Refused arguments; each receipt is [outcome, code, recorded arguments], and the generic bound records none of the refused tree. */
export const INVALID_GATEWAY_ARGUMENTS: ReadonlyArray<InvalidGatewayArgumentsShape> = [
    {
        label: "unbounded payloads",
        setup: {},
        tool: TOOL.paymentCreditList,
        args: { text: "x".repeat(8193) },
        audit: [["refused", "invalid_arguments", "{}"]],
    },
    {
        label: "a prototype key",
        setup: {},
        tool: TOOL.paymentCreditList,
        args: { filter: prototypeKeyed() },
        audit: [["refused", "invalid_arguments", "{}"]],
    },
    {
        label: "unbounded payloads to an unknown tool",
        setup: {},
        tool: "nivo.tool.payment.nothing",
        args: { text: "x".repeat(8193) },
        audit: [],
    },
    {
        label: "invalid native limits",
        setup: { grants: [toolGrantRowOf({ tool: "nivo.tool.payment.*", mode: "ask" })] },
        tool: TOOL.paymentCreditList,
        args: { limit: 51 },
        audit: [["refused", "invalid_arguments", '{"limit":51}']],
    },
]
