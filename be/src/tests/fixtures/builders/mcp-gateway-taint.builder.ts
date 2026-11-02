import type { FakeClock, MockOf } from "@starci/jest-preset"
import { eachInOrder } from "@modules/platform/primitives"
import { SEPAY_MANIFEST } from "@modules/domain/mcp-gateway"
import type {
    GatewayCaller,
    McpGatewayService,
    NativeAdapter,
    NativeConnectorManifest,
} from "@modules/domain/mcp-gateway"
import type { McpRemote } from "@modules/integrations/mcp"
import { GATEWAY_CALLER } from "./mcp-gateway.builder"

/** The SePay connector as an open tool of every caller, so the specs of the call path do not depend on who asks. */
export const OPEN_SEPAY_MANIFEST: NativeConnectorManifest = {
    ...SEPAY_MANIFEST,
    tools: SEPAY_MANIFEST.tools.map((tool) => ({ ...tool, internalOnly: false })),
}

/** The SePay connector with every tool for internal use only. */
export const INTERNAL_SEPAY_MANIFEST: NativeConnectorManifest = {
    ...SEPAY_MANIFEST,
    tools: SEPAY_MANIFEST.tools.map((tool) => ({ ...tool, internalOnly: true })),
}

/** A native connector with a read whose answer carries tainted text, a plain read and a write. */
export const TAINTING_MANIFEST: NativeConnectorManifest = {
    ...SEPAY_MANIFEST,
    tools: SEPAY_MANIFEST.tools.slice(0, 1).flatMap((base) => [
        { ...base, name: "read", internalOnly: false, taints: true },
        { ...base, name: "peek", internalOnly: false },
        { ...base, name: "act", internalOnly: false, scope: "write" as const },
    ]),
}

/** What a turn that read tainted text came to: the plain read, the write asked for a person, the approved write, and the write after the window. */
export const taintedTurnExpected = [
    { ok: true, value: { transactions: [] }, summary: '{"transactions":[]}' },
    { ok: false, code: "approval_required", reason: "tainted_input" },
    { ok: true, value: { transactions: [] }, summary: '{"transactions":[]}' },
    { ok: true, value: { transactions: [] }, summary: '{"transactions":[]}' },
]

/** Runs that turn: a tainting read, a write (asked), the same write approved by a person, and the write again after the window. */
export const taintedTurnOf = async (gateway: McpGatewayService, clock: FakeClock, caller: GatewayCaller) => {
    const writer = { ...caller, opKey: "step-1" }
    await gateway.call(writer, "sepay.read", {})
    const asked = await gateway.call(writer, "sepay.act", {})
    const approved = await gateway.call({ ...writer, approvedBy: "person-1" }, "sepay.act", {})
    const peeked = await gateway.call(writer, "sepay.peek", {})
    clock.advance(16 * 60_000)
    return [peeked, asked, approved, await gateway.call(writer, "sepay.act", {})]
}

/** Replays the same held-room intent, then changes its operation identity and finally supplies the caller's replay key. */
export const replayedHoldKeysOf = async (
    gateway: McpGatewayService,
    remote: MockOf<McpRemote>,
    caller: GatewayCaller,
) => {
    const step = { ...caller, workItemId: "item-1" }
    const hold = { roomType: "deluxe", checkIn: "2026-10-24", nights: 2, guests: 2, guestId: "g1" }
    await gateway.call(step, "hakuen.booking.hold", hold)
    await gateway.call(step, "hakuen.booking.hold", hold)
    await gateway.call({ ...step, opKey: "item-1:rehold" }, "hakuen.booking.hold", hold)
    await gateway.call(step, "hakuen.booking.hold", { ...hold, idempotencyKey: "mine" })
    return remote.call.mock.calls.map(([request]) => request.args.idempotencyKey)
}

/** Makes two semantically equal confirmation requests under the same operation, retaining both results for the spec. */
export const replayedConfirmationOf = async (gateway: McpGatewayService, original: GatewayCaller) => {
    const caller = { ...original, opKey: "customer-message:confirm" }
    const args = { holdId: "hold-1", discountPct: 0 }
    const first = await gateway.call(caller, "hakuen.booking.confirm", args)
    const retried = await gateway.call(caller, "hakuen.booking.confirm", { discountPct: 0, holdId: "hold-1" })
    return { caller, args, first, retried }
}

/** Places a native connector into its half-open recovery window through five actual failed calls. */
export const openNativeGatewayBreaker = async (
    gateway: McpGatewayService,
    native: MockOf<NativeAdapter>,
    clock: FakeClock,
    caller: GatewayCaller,
): Promise<void> => {
    native.invoke.mockRejectedValue(new Error("down"))
    await eachInOrder(Array.from({ length: 5 }), () => gateway.call(caller, "sepay.transactions.list", {}))
    clock.advance(120_000)
}

/** A successful read whose account field was hidden by the caller's payment right. */
export const HIDDEN_REPLY = {
    ok: true,
    value: { transactions: [{ id: "t1" }] },
    summary: '{"transactions":[{"id":"t1"}]}',
}

/** The workspace payment right that hides the account field. */
export const PAYMENT_RIGHT = { kind: "payments", scope: "workspace", hide: ["account"], mask: [] } as const

/** A work-item write in an agent turn governed by its graph. */
export const GRAPH_CALLER = { ...GATEWAY_CALLER, workItemId: "item-1", turnId: "turn-1" }

/** The masked response of the held booking. */
export const HELD_REPLY = { ok: true, value: { holdId: "h1" }, summary: '{"holdId":"h1"}' }

/** The masked confirmation returned after a connector recovers. */
export const CONFIRMED_REPLY = { ok: true, value: { bookingId: "b1" }, summary: '{"bookingId":"b1"}' }

/** The masked empty-stay read returned after a connector recovers. */
export const CURRENT_STAY_REPLY = { ok: true, value: { stay: null }, summary: '{"stay":null}' }

/** The graph's two held-write verdicts and their exact public and audit outcomes. */
export const GRAPH_HOLDS = [
    [{ kind: "stop" }, { ok: false, code: "not_granted", detail: "graph_stop" }, "refused", "graph_stop"],
    [{ kind: "ask" }, { ok: false, code: "approval_required", reason: "graph_ask" }, "approval", "graph_ask"],
] as const
