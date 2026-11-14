import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    type ToolCaller,
    type ToolRegistryService,
    type NativeToolFamily,
    type ToolManifest,
    type ToolCallResult,
    SEPAY_MANIFEST,
} from "@modules/domain/tools"
import type { FakeClock, MockOf } from "@starci/jest-preset"
import { eachInOrder } from "@modules/platform/primitives"

/** The SePay connector as an open tool of every caller, so the specs of the call path do not depend on who asks. */
export const OPEN_SEPAY_MANIFEST: ToolManifest = {
    ...SEPAY_MANIFEST,
    tools: SEPAY_MANIFEST.tools.map((tool) => ({ ...tool, internalOnly: false })),
}

/** The SePay connector with every tool for internal use only. */
export const INTERNAL_SEPAY_MANIFEST: ToolManifest = {
    ...SEPAY_MANIFEST,
    tools: SEPAY_MANIFEST.tools.map((tool) => ({ ...tool, internalOnly: true })),
}

/** A native connector with a read whose answer carries tainted text, a plain read and a write. */
export const TAINTING_MANIFEST: ToolManifest = {
    ...SEPAY_MANIFEST,
    tools: SEPAY_MANIFEST.tools.slice(0, 1).flatMap((base) => [
        { ...base, name: "read", internalOnly: false, taints: true },
        { ...base, name: "peek", internalOnly: false },
        { ...base, name: "act", internalOnly: false, scope: "write" as const },
    ]),
}

type TaintedTurnExpectedShape2 = {
    ok: boolean
    code: string
    reason: string
    value?: never
    summary?: never
}

type TaintedTurnExpectedValueShape = {
    transactions: Array<never>
}

type TaintedTurnExpectedShape = {
    ok: boolean
    value: TaintedTurnExpectedValueShape
    summary: string
    code?: never
    reason?: never
}

/** What a turn that read tainted text came to: the plain read, the write asked for a person, the approved write, and the write after the window. */
export const taintedTurnExpected: Array<TaintedTurnExpectedShape | TaintedTurnExpectedShape2> = [
    { ok: true, value: { transactions: [] }, summary: '{"transactions":[]}' },
    { ok: false, code: "approval_required", reason: "tainted_input" },
    { ok: true, value: { transactions: [] }, summary: '{"transactions":[]}' },
    { ok: true, value: { transactions: [] }, summary: '{"transactions":[]}' },
]

/** Runs that turn: a tainting read, a write (asked), the same write approved by a person, and the write again after the window. */
export const taintedTurnOf = async (
    gateway: ToolRegistryService,
    clock: FakeClock,
    caller: ToolCaller,
): Promise<Array<ToolCallResult>> => {
    const writer = { ...caller, opKey: "step-1" }
    await gateway.call(writer, "nivo.tool.payment.read", {})
    const asked = await gateway.call(writer, "nivo.tool.payment.act", {})
    const approved = await gateway.call({ ...writer, approvedBy: "person-1" }, "nivo.tool.payment.act", {})
    const peeked = await gateway.call(writer, "nivo.tool.payment.peek", {})
    clock.advance(16 * 60_000)
    return [peeked, asked, approved, await gateway.call(writer, "nivo.tool.payment.act", {})]
}

/** Replays the same held-room intent, then changes its operation identity and finally supplies the caller's replay key. */
export const replayedHoldKeysOf = async (
    gateway: ToolRegistryService,
    partner: MockOf<NativeToolFamily>,
    caller: ToolCaller,
): Promise<Array<unknown>> => {
    const step = { ...caller, workItemId: "item-1" }
    const hold = { roomType: "deluxe", checkIn: "2026-10-24", nights: 2, guests: 2, guestId: "g1" }
    await gateway.call(step, "hakuen.booking.hold", hold)
    await gateway.call(step, "hakuen.booking.hold", hold)
    await gateway.call({ ...step, opKey: "item-1:rehold" }, "hakuen.booking.hold", hold)
    await gateway.call(step, "hakuen.booking.hold", { ...hold, idempotencyKey: "mine" })
    return partner.invoke.mock.calls.map(([, , args]) => args.idempotencyKey)
}

type ReplayedConfirmationOfResultArgsShape = {
    holdId: string
    discountPct: number
}

type ReplayedConfirmationOfResultCallerShape = {
    opKey: string
    workspaceId: string
    agentId: string
    conversationId: string | null
    workItemId: string | null
    audience?: "customer" | "internal"
    approvedBy?: string
    turnId?: string | undefined
}

type ReplayedConfirmationOfResultShape = {
    caller: ReplayedConfirmationOfResultCallerShape
    args: ReplayedConfirmationOfResultArgsShape
    first: ToolCallResult
    retried: ToolCallResult
}

/** Makes two semantically equal confirmation requests under the same operation, retaining both results for the spec. */
export const replayedConfirmationOf = async (
    gateway: ToolRegistryService,
    original: ToolCaller,
): Promise<ReplayedConfirmationOfResultShape> => {
    const caller = { ...original, opKey: "customer-message:confirm" }
    const args = { holdId: "hold-1", discountPct: 0 }
    const first = await gateway.call(caller, "hakuen.booking.confirm", args)
    const retried = await gateway.call(caller, "hakuen.booking.confirm", { discountPct: 0, holdId: "hold-1" })
    return { caller, args, first, retried }
}

/** Places a native connector into its half-open recovery window through five actual failed calls. */
export const openNativeGatewayBreaker = async (
    gateway: ToolRegistryService,
    native: MockOf<NativeToolFamily>,
    clock: FakeClock,
    caller: ToolCaller,
): Promise<void> => {
    native.invoke.mockRejectedValue(new Error("down"))
    await eachInOrder(Array.from({ length: 5 }), () => gateway.call(caller, TOOL.paymentCreditList, {}))
    clock.advance(120_000)
}

type HiddenReplyValueTransactionsShape = {
    id: string
}

type HiddenReplyValueShape = {
    transactions: Array<HiddenReplyValueTransactionsShape>
}

type HiddenReplyShape = {
    ok: boolean
    value: HiddenReplyValueShape
    summary: string
}

/** A successful read whose account field was hidden by the caller's payment right. */
export const HIDDEN_REPLY: HiddenReplyShape = {
    ok: true,
    value: { transactions: [{ id: "t1" }] },
    summary: '{"transactions":[{"id":"t1"}]}',
}

/** The workspace payment right that hides the account field. */
export const PAYMENT_RIGHT = { kind: "payments", scope: "workspace", hide: ["account"], mask: [] } as const

/** The masked response of the held booking. */
export const HELD_REPLY = { ok: true, value: { holdId: "h1" }, summary: '{"holdId":"h1"}' }

/** The masked confirmation returned after a connector recovers. */
export const CONFIRMED_REPLY = { ok: true, value: { bookingId: "b1" }, summary: '{"bookingId":"b1"}' }

/** The masked empty-stay read returned after a connector recovers. */
export const CURRENT_STAY_REPLY = { ok: true, value: { stay: null }, summary: '{"stay":null}' }

