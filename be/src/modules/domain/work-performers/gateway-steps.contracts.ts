import type { GatewayJson } from "@modules/domain/mcp-gateway"

/** One connector call of a sequence a person approves at once. */
export interface GatewayStep {
    /** The full tool name. */
    readonly name: string
    /** The exact arguments. */
    readonly arguments: GatewayJson
}

/** The steps of a sequence, in order, or null when the text names no valid sequence. */
export type GatewaySteps = ReadonlyArray<GatewayStep> | null
