import type { FakeClock } from "@starci/jest-preset"
import { SEPAY_MANIFEST } from "@modules/domain/mcp-gateway"
import type { GatewayCaller, McpGatewayService, NativeConnectorManifest } from "@modules/domain/mcp-gateway"

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
    { ok: true, value: { transactions: [] } },
    { ok: false, code: "approval_required", reason: "tainted_input" },
    { ok: true, value: { transactions: [] } },
    { ok: true, value: { transactions: [] } },
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
