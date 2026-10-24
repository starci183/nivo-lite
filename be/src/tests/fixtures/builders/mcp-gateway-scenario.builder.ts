import type { MockOf } from "@starci/jest-preset"
import type { CallLogLine, McpCallLogService } from "@modules/domain/mcp-call-log"
import type { McpConnectorRow, McpConnectorsService } from "@modules/domain/mcp-connectors"
import type { GatewayCaller, GatewayCallResult, GatewayJson } from "@modules/domain/mcp-gateway"
import type { GatewayReceiptsService } from "@modules/domain/mcp-gateway-receipts"
import type { McpToolGrantsService } from "@modules/domain/mcp-tool-grants"
import { McpErrorCode } from "@modules/integrations/mcp"
import type { McpRemote } from "@modules/integrations/mcp"
import type { QueueTimeout } from "@modules/platform/queue"
import {
    catalogToolOf,
    GATEWAY_BEARER,
    GATEWAY_CALLER,
    GATEWAY_CATALOG,
    remoteConnectorRowOf,
    roleProvidersOf,
    toolGrantRowOf,
} from "./mcp-gateway.builder"
import type { GatewaySpecSetup } from "./mcp-gateway.builder"

/** The typed constructor doubles whose deterministic defaults one gateway scenario arranges. */
interface GatewayScenarioDoubles {
    /** The remote connector transport. */
    readonly remote: MockOf<McpRemote>
    /** The deadline scheduler. */
    readonly timeout: MockOf<QueueTimeout>
    /** The cancellation function created by the spec's scheduler double. */
    readonly cancel: () => void
    /** The workspace's connector rows. */
    readonly connectors: MockOf<McpConnectorsService>
    /** The agent's tool grants. */
    readonly grants: MockOf<McpToolGrantsService>
    /** The stored outcomes of side-effect calls. */
    readonly receipts: MockOf<GatewayReceiptsService>
}

/** Configures constructor doubles while the spec keeps the actual Nest module and every token binding. */
export const arrangeGatewayScenario = (setup: GatewaySpecSetup, doubles: GatewayScenarioDoubles) => {
    doubles.remote.call.mockResolvedValue({ isError: false, value: { holdId: "h1", code: "777" } })
    doubles.timeout.schedule.mockReturnValue(doubles.cancel)
    doubles.connectors.list.mockResolvedValue(setup.rows ?? [remoteConnectorRowOf()])
    doubles.grants.listOfAgent.mockResolvedValue(setup.grants ?? [toolGrantRowOf()])
    doubles.grants.agentsGranted.mockResolvedValue(["a1", "a2"])
    const results = new Map<string, Promise<GatewayCallResult>>()
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
export const gatewayLinesOf = (callLog: MockOf<McpCallLogService>): ReadonlyArray<CallLogLine> =>
    callLog.append.mock.calls.map(([line]) => line)

/** A disabled connector advertises a receivable role without being a usable provider. */
export const disabledReceivableConnectorOf = () =>
    remoteConnectorRowOf({
        key: "pay",
        name: "Pay Gateway",
        status: "disabled",
        tool_catalog: [
            catalogToolOf("receivable.lookup", "Find a receivable.", true, {
                meta: { "nivo/role": "receivable.find" },
            }),
        ],
    })

/** A connector whose named tool no longer has its approved live schema. */
export const changedToolConnectorOf = (name: string) =>
    remoteConnectorRowOf({
        tool_catalog: GATEWAY_CATALOG.map((tool) => (tool.name === name ? { ...tool, hash: "hash-new" } : tool)),
    })

/** A live catalog that has never had the spa slot search approved. */
export const unapprovedSpaConnectorOf = () =>
    remoteConnectorRowOf({
        approved_catalog: GATEWAY_CATALOG.filter((tool) => tool.name !== "spa.findSlots").map(({ name, hash }) => ({
            name,
            hash,
        })),
    })

/** A granted receivable role whose absent read hint makes it a write under the remote catalog contract. */
export const defaultWriteRoleConnectorOf = () => {
    const tool = catalogToolOf("receivable.lookup", "Find a receivable.", false, {
        annotations: {},
        meta: { "nivo/role": "receivable.find" },
    })
    return remoteConnectorRowOf({
        key: "pay",
        name: "Pay Gateway",
        tool_catalog: [tool],
        approved_catalog: [{ name: tool.name, hash: tool.hash }],
    })
}

/** Missing or blank operation identities, including an explicit blank that must not fall back to a work item. */
export const MISSING_WRITE_IDENTITIES: ReadonlyArray<{
    readonly label: string
    readonly caller: GatewayCaller
    readonly native: boolean
}> = [
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
export const VALID_WRITE_IDENTITIES: ReadonlyArray<GatewayCaller> = [
    { ...GATEWAY_CALLER, opKey: undefined, workItemId: "item-1" },
    { ...GATEWAY_CALLER, opKey: "message-1", workItemId: " " },
]

/** A live schema whose replay-field declaration and matching approval change together. */
const replaySchemaRowOf = (hasReplayArgument: boolean) => {
    const tool = catalogToolOf("booking.confirm", "Confirm a held booking.", false, {
        inputSchema: {
            type: "object",
            properties: hasReplayArgument ? { idempotencyKey: { type: "string" } } : {},
        },
        hash: hasReplayArgument ? "hash-with-replay" : "hash-without-replay",
    })
    return remoteConnectorRowOf({
        catalog_hash: tool.hash,
        tool_catalog: [tool],
        approved_catalog: [{ name: tool.name, hash: tool.hash }],
    })
}

/** The same client operation retried after an approved replay field is added or removed. */
export const REPLAY_SCHEMA_CHANGES: ReadonlyArray<{
    readonly label: string
    readonly caller: GatewayCaller
    readonly args: GatewayJson
    readonly before: McpConnectorRow
    readonly after: McpConnectorRow
    readonly firstHasReplayKey: boolean
}> = [false, true].map((firstHasReplayKey) => ({
    label: firstHasReplayKey ? "removes a replay argument" : "adds a replay argument",
    caller: { ...GATEWAY_CALLER, opKey: "schema-change:confirm" },
    args: { holdId: "schema-hold", discountPct: 0 },
    before: replaySchemaRowOf(firstHasReplayKey),
    after: replaySchemaRowOf(!firstHasReplayKey),
    firstHasReplayKey,
}))

/** Provider-call counts for one timed-out write, before its client retries the stored outcome. */
export const TIMED_OUT_WRITES: ReadonlyArray<{
    readonly label: string
    readonly tool: string
    readonly args: GatewayJson
    readonly attempts: number
}> = [
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

type GatewayScenario =
    | "registry"
    | "discovery"
    | "description"
    | "roles"
    | "unavailable-roles"
    | "readiness"
    | "schema-refusal"
    | "approval"
    | "missing-identity"

/** Fresh connector and grant data for the gateway's registry, role and admission scenarios. */
export const gatewayScenarioOf = (scenario: GatewayScenario): GatewaySpecSetup => {
    switch (scenario) {
        case "registry":
            return {
                rows: [
                    remoteConnectorRowOf({ timeout_ms: 10 }),
                    remoteConnectorRowOf({ key: "sepay", kind: "native", status: "disabled", timeout_ms: 99_999 }),
                ],
            }
        case "discovery":
            return {
                rows: [
                    unapprovedSpaConnectorOf(),
                    remoteConnectorRowOf({ key: "sepay", kind: "native", status: "disabled" }),
                ],
                grants: [toolGrantRowOf(), toolGrantRowOf({ tool: "sepay.*" })],
            }
        case "description":
            return {
                rows: [changedToolConnectorOf("stay.current")],
                grants: [toolGrantRowOf(), toolGrantRowOf({ tool: "hakuen.keycode.reveal", mode: "never" })],
            }
        case "roles":
            return { rows: [remoteConnectorRowOf(), remoteConnectorRowOf({ key: "shop", approved_catalog: [] })] }
        case "unavailable-roles":
            return {
                rows: [
                    remoteConnectorRowOf({ approved_catalog: [] }),
                    remoteConnectorRowOf({ key: "sepay", kind: "native", status: "disabled" }),
                ],
            }
        case "readiness":
            return { rows: [remoteConnectorRowOf(), disabledReceivableConnectorOf()] }
        case "schema-refusal":
            return {
                rows: [
                    changedToolConnectorOf("booking.hold"),
                    remoteConnectorRowOf({ key: "shop", approved_catalog: [] }),
                ],
            }
        case "approval":
            return {
                grants: [
                    toolGrantRowOf(),
                    toolGrantRowOf({ tool: "hakuen.booking.cancel", mode: "ask", constraints: [] }),
                ],
            }
        case "missing-identity":
            return {
                rows: [defaultWriteRoleConnectorOf()],
                grants: [
                    toolGrantRowOf({ tool: "pay.*", constraints: [] }),
                    toolGrantRowOf({ tool: "sepay.*", constraints: [] }),
                ],
            }
    }
}

/** A replacement speaker serves the same operation without inheriting its former conversation routing. */
export const reroutedCallerOf = (caller: GatewayCaller): GatewayCaller => ({
    ...caller,
    agentId: "replacement-agent",
    conversationId: null,
})

/** Fixed public values expected by the gateway scenarios, independent of the subject's implementation. */
export const GATEWAY_SCENARIO_EXPECTED = {
    connectorStates: [
        ["sepay", "disabled", 15_000],
        ["hakuen", "active", 500],
    ],
    reply: { ok: true, value: { holdId: "h1", code: "777" } },
    held: { ok: true, value: { holdId: "h1" } },
    native: { ok: true, value: { transactions: [] } },
    toolRefusal: { ok: false, code: "tool_error", detail: '{"error":{"code":"***"}}' },
    readTimeout: { ok: false, code: "unavailable", detail: McpErrorCode.Timeout },
    readFailure: { ok: false, code: "unavailable", detail: "internal" },
    circuitOpen: { ok: false, code: "unavailable", detail: "circuit_open" },
    readyRoles: {
        ready: true,
        missing: [],
        providers: roleProvidersOf({
            "identity.find": ["HAKUEN"],
            "receivable.find": ["Pay Gateway"],
            "payment.credits.list": ["SePay"],
            "payment.debits.list": ["SePay"],
        }),
    },
    missingReceivableReadiness: { ready: false, missing: ["receivable.find"] },
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
        ["timeout", McpErrorCode.Timeout],
        ["error", "internal"],
    ],
    unknownWriteOutcomes: [["timeout", "unknown_outcome"]],
    unknownWriteOutcome: { ok: false, code: "unknown_outcome", detail: McpErrorCode.Timeout },
    grants: [{ tool: "hakuen.*", mode: "auto", limitVnd: null, constraints: [{ arg: "discountPct", max: 10 }] }],
    creditsRole: {
        ok: true,
        tool: {
            role: "payment.credits.list",
            name: "sepay.transactions.list",
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
    revealRequest: {
        endpoint: { url: "https://hakuen.test/mcp", bearer: GATEWAY_BEARER },
        name: "keycode.reveal",
        args: { stayId: "s1" },
        timeoutMs: 4000,
    },
    revealedAudit: { outcome: "ok", errorCode: null, resultSummary: '{"holdId":"h1","code":"***"}' },
    failedReadContext: { workspaceId: "ws-1", connector: "hakuen", tool: "stay.current" },
    schemaRefusals: [
        ["hakuen.booking.hold", "refused", "schema_unapproved"],
        ["shop.stay.current", "refused", "schema_unapproved"],
    ],
}
