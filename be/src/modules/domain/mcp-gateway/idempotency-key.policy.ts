import { createHash } from "node:crypto"
import { argsHashOf } from "./audit-mask.policy"
import type { GatewayCaller, GatewayJson, GatewayToolSpec } from "./mcp-gateway.contracts"

/** The replay keys the gateway writes start with this, so the remote's log tells them from a caller's own. */
const KEY_PREFIX = "nivo:"

/** The step a call belongs to: the caller's own key, else its work item; null when the call has no stable identity. */
const stepOf = (caller: GatewayCaller): string | null => caller.opKey ?? caller.workItemId ?? null

/**
 * The arguments of a call with its replay key filled in: a side-effect tool that takes one (its `idempotencyArg`) and was called
 * without it gets `nivo:<sha256(workspace, step, tool, arguments)>`. A re-run of the same step with the same arguments, or the
 * replay of its approval, sends the same key, so the remote answers its stored result instead of acting twice; another step or
 * other arguments make another key. A read, a tool without the argument, a key the caller chose, or a call with no step
 * (no `opKey`, no work item) is left as it is.
 */
export const withReplayKey = (
    spec: GatewayToolSpec,
    caller: GatewayCaller,
    name: string,
    args: GatewayJson,
): GatewayJson => {
    const arg = spec.idempotencyArg
    const step = stepOf(caller)
    if (spec.scope === "read" || arg === undefined || args[arg] !== undefined || step === null) return args
    const key = createHash("sha256")
        .update(JSON.stringify([caller.workspaceId, step, name, argsHashOf(args)]))
        .digest("hex")
    return { ...args, [arg]: `${KEY_PREFIX}${key}` }
}
