import type { GatewayJson } from "@modules/domain/mcp-gateway"
import { parseJsonText } from "@modules/platform/primitives"
import type { GatewayStep, GatewaySteps } from "./gateway-steps.contracts"

/** How many steps one sequence may name. */
export const GATEWAY_STEPS_MAX = 10
/** The longest tool name a step keeps. */
const NAME_MAX = 200

const isObject = (value: unknown): value is GatewayJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const stepOf = (value: unknown): GatewayStep | null => {
    if (!isObject(value) || typeof value.name !== "string" || value.name.trim() === "") return null
    return { name: value.name.trim().slice(0, NAME_MAX), arguments: isObject(value.arguments) ? value.arguments : {} }
}

/**
 * The connector calls a sequence names, from its JSON text: a list of one to ten `{name, arguments}`, or null when it is anything
 * else, so a malformed sequence is refused whole and never runs in part.
 */
export const gatewayStepsOf = (text: unknown): GatewaySteps => {
    const read = parseJsonText(typeof text === "string" ? text : "")
    if (!read.ok || !Array.isArray(read.value)) return null
    const list: ReadonlyArray<unknown> = read.value
    if (list.length === 0 || list.length > GATEWAY_STEPS_MAX) return null
    const steps = list.map(stepOf)
    return steps.every((step): step is GatewayStep => step !== null) ? steps : null
}
