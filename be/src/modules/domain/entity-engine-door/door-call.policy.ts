import type { ToolApprovalReason, ToolCallResult } from "@modules/domain/tool-receipts"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { DoorCallResult, DoorFailure, DoorTool } from "@nivo-lite/agent-sdk/mutation"

/** The deepest nesting of a connector answer read as JSON. */
const JSON_DEPTH_MAX = 32

/** The gateway failures that mean the caller sent something the gateway cannot read. */
const INVALID = new Set(["invalid_arguments", "invalid_name", "idempotency_key_required"])

/** The gateway failures that mean the call is not allowed for this caller or this connection. */
const FORBIDDEN = new Set(["not_granted", "internal_only"])

/** The gateway failures a retry may cure: the provider was unreachable or its outcome is unknown. */
const TRANSIENT = new Set(["unavailable", "unknown_outcome"])

/**
 * The gateway tool name of a door tool. A door tool is `<group>.<provider>.<action>`; the group names the module that asks for the
 * effect and the gateway knows the connector (`<provider>`) and its tool (`<action>`) only, so the group is dropped.
 */
export const gatewayNameOf = (tool: DoorTool): string => tool.slice(tool.indexOf(".") + 1)

/** The failure kind a gateway failure code stands for; any code the table does not name is a failure of the provider. */
const failureOf = (code: string): DoorFailure => {
    if (code === "unknown_tool") return "unknown_tool"
    if (INVALID.has(code)) return "invalid"
    if (FORBIDDEN.has(code)) return "forbidden"
    if (TRANSIENT.has(code)) return "transient"
    return "failed"
}

/** What a person must still approve before the call runs, as the message of a refusal. */
const approvalMessageOf = (reason: ToolApprovalReason): string => `approval_required:${reason}`

/** Whether a value is JSON: a connector answers JSON, and a value that is not (a function, a symbol, a cycle) is a failure of the provider. */
const isJson = (value: unknown, depth = 0): value is JsonValue => {
    if (depth > JSON_DEPTH_MAX) return false
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true
    if (Array.isArray(value)) return value.every((item) => isJson(item, depth + 1))
    return typeof value === "object" && Object.values(value).every((member) => isJson(member, depth + 1))
}

/** The door answer of a gateway answer: the output of an ok call, otherwise the failure kind and the gateway's own words. */
export const doorResultOf = (result: ToolCallResult): DoorCallResult => {
    if (result.ok) {
        return isJson(result.value)
            ? { ok: true, output: result.value }
            : { ok: false, reason: "failed", message: "output_not_json" }
    }
    if (result.code === "approval_required")
        return { ok: false, reason: "forbidden", message: approvalMessageOf(result.reason) }
    return { ok: false, reason: failureOf(result.code), message: result.detail }
}

/**
 * The replay key of one door call: the job's effect key for the call's tool, joined to the hash of its arguments, so a retry of the
 * job repeats the same call under the same key (the gateway runs it once) and two calls with other arguments never share one.
 */
export const opKeyOf = (effectKey: (step: string) => string, tool: DoorTool, argsHash: string): string =>
    `${effectKey(tool)}:${argsHash}`
