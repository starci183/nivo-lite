import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    type ToolCaller,
    type ToolJson,
    type RoleReadiness,
    type NativeToolFamily,
    type CapabilityRole,
    type ManifestTool,
    type ToolManifest,
    toolArgumentsSchema,
} from "@modules/domain/tools"
import { createHash } from "node:crypto"
import { builder, type FakeClock, type MockOf } from "@starci/jest-preset"
import type { CallLogLine, ToolCallLogService } from "@modules/domain/tool-call-log"
import type { ToolGrantView, ToolGrantsService } from "@modules/domain/tool-grants"
import type { ToolReceiptsService } from "@modules/domain/tool-receipts"
import type { Logger } from "@modules/platform/logging"
import type { QueueTimeout } from "@modules/platform/queue"

/** The caller of the gateway specs: an agent in a conversation, with no work item. */
export const GATEWAY_CALLER: ToolCaller = {
    workspaceId: "ws-1",
    agentId: "sales",
    conversationId: "conv-1",
    workItemId: null,
}

/** One tool of the HAKUEN partner family of the gateway specs: a read or a write, under the generic argument bound. */
export const hakuenToolOf = (name: string, description: string, read: boolean, extra: Partial<ManifestTool> = {}): ManifestTool => ({
    name,
    description,
    scope: read ? "read" : "write",
    inputSchema: { type: "object" },
    argumentSchema: toolArgumentsSchema,
    defaultMode: "ask",
    ...extra,
})

/**
 * The HAKUEN partner tool family of the gateway specs, registered in code (a hotel back-office: rooms, bookings, spa, stays, key codes,
 * guests). The room hold takes its replay key in `idempotencyKey`; the guest lookup plays `identity.find`.
 */
export const HAKUEN_MANIFEST: ToolManifest = {
    key: "hakuen",
    name: "HAKUEN",
    contractVersion: "hakuen-native@1",
    tools: [
        hakuenToolOf("rooms.searchAvailability", "Room types free for a check-in date, nights and guests.", true),
        hakuenToolOf("booking.hold", "Hold a room type for 30 minutes for a guest.", false, {
            inputSchema: { type: "object", properties: { idempotencyKey: { type: "string" } } },
            idempotencyArg: "idempotencyKey",
        }),
        hakuenToolOf("booking.confirm", "Confirm a held booking.", false),
        hakuenToolOf("booking.cancel", "Cancel a booking with a reason.", false),
        hakuenToolOf("spa.findSlots", "Free spa slots for a service, date, party size and earliest time.", true),
        hakuenToolOf("spa.hold", "Hold a spa slot for a guest and party size.", false),
        hakuenToolOf("spa.confirm", "Confirm a held spa booking.", false),
        hakuenToolOf("stay.current", "The current or next stay of a guest.", true),
        hakuenToolOf("keycode.reveal", "The room key code of a checked-in stay.", false),
        hakuenToolOf("guest.findByChannelIdentity", "The guest of a channel identity.", true, { role: "identity.find" }),
    ],
}

/** What the HAKUEN family answers by default in the gateway specs: a held room with its key code. */
export const HAKUEN_ANSWER: ToolJson = { holdId: "h1", code: "777" }

/** A grant of every tool of the HAKUEN family, auto, with one data constraint. */
export const toolGrantRowOf: (overrides?: Partial<ToolGrantView>) => ToolGrantView = builder<ToolGrantView>({
    tool: "hakuen.*",
    mode: "auto",
    limit_vnd: null,
    constraints: [{ arg: "discountPct", max: 10 }],
})

type RefusalOfResultShape = {
    ok: boolean
    code: string
    detail: string
}

/** The refusal a gateway call answers. */
export const refusalOf = (code: string, detail: string): RefusalOfResultShape => ({ ok: false, code, detail })

type AnswerOfResultShape = {
    ok: boolean
    value: ToolJson
}

/** The answer of a gateway call that ran. */
export const answerOf = (value: ToolJson): AnswerOfResultShape => ({ ok: true, value })

/** The audit line of a refused, ungranted read of the bank credits by the spec caller. */
export const refusedReadLineOf: (overrides?: Partial<CallLogLine>) => CallLogLine = builder<CallLogLine>({
    workspaceId: "ws-1",
    connector: "sepay",
    tool: TOOL.paymentCreditList,
    agentId: "sales",
    conversationId: "conv-1",
    workItemId: null,
    argsMaskedJson: '{"limit":5}',
    argsHash: createHash("sha256").update('{"limit":5}').digest("hex"),
    outcome: "refused",
    errorCode: "not_granted",
    resultSummary: "",
    durationMs: 0,
    approvedBy: null,
    runId: null,
    factReads: null,
    originKind: null,
    nodeKey: null,
    workflowId: null,
    workflowVersionId: null,
    recordsRead: null,
    recordsChanged: null,
    connectionId: null,
    provider: null,
    attempt: null,
    chosenBy: null,
})

/** The providers of every capability role, none unless the spec names some. */
export const roleProvidersOf: (
    overrides?: Partial<Readonly<Record<CapabilityRole, ReadonlyArray<string>>>>,
) => Readonly<Record<CapabilityRole, ReadonlyArray<string>>> = builder<RoleReadiness["providers"]>({
    "identity.find": [],
    "identity.upsert": [],
    "receivable.find": [],
    "receivable.recordPayment": [],
    "payment.credits.list": [],
    "payment.debits.list": [],
    "invoice.list": [],
})

/**
 * What a gateway spec sets up: the tool families it runs beside the SePay one (HAKUEN unless it names others), the grant rows and the
 * default time limit.
 */
export interface GatewaySpecSetup {
    readonly families?: ReadonlyArray<ToolManifest>
    readonly grants?: ReadonlyArray<ToolGrantView>
    readonly timeoutMs?: number
}

/** The scheduler cancellation port observed by the unit spec. */
export interface GatewayCancellation {
    /** The scheduler cancellation function observed by the unit spec. */
    readonly cancel: () => void
}

/** Actual constructor doubles made by the colocated spec; helpers configure these same references. */
export interface GatewaySpecDoubles {
    /** The deterministic gateway clock. */
    readonly clock: FakeClock
    /** The captured structured logger. */
    readonly logger: MockOf<Logger>
    /** The SePay family. */
    readonly native: MockOf<NativeToolFamily>
    /** The partner family the spec runs beside SePay (HAKUEN unless the setup names another first). */
    readonly partner: MockOf<NativeToolFamily>
    /** The connector deadline scheduler. */
    readonly timeout: MockOf<QueueTimeout>
    /** The tool grant reader. */
    readonly grants: MockOf<ToolGrantsService>
    /** The captured call audit. */
    readonly callLog: MockOf<ToolCallLogService>
    /** The claimed call receipt boundary. */
    readonly receipts: MockOf<ToolReceiptsService>
    /** The deadline cancellation callback. */
    readonly cancel: () => void
}

/** Configures the same kit doubles the spec provides to its real subject. */
export const arrangeGatewayDoubles = (doubles: GatewaySpecDoubles): void => {
    doubles.native.invoke.mockResolvedValue({ transactions: [] })
    doubles.partner.invoke.mockResolvedValue(HAKUEN_ANSWER)
}
