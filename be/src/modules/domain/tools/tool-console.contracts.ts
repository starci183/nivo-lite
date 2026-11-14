import type { ConnectionActor } from "@modules/domain/connections"
import type { ToolApprovalReason } from "@modules/domain/tool-receipts"
import type { ArgConstraint, GrantMode } from "@modules/domain/tool-grants"
import type { ToolManifest } from "./tool-manifest.contracts"

/** A tool family as every workspace runs it. */
export interface WorkspaceToolFamily {
    /** The manifest. */
    readonly manifest: ToolManifest
    /** The per-call limit in milliseconds, within the engine's floor and ceiling. */
    readonly timeoutMs: number
}

/** One grant of a tool (or `connector.*`) to an agent. */
export interface ToolGrant {
    /** The full tool name or `connector.*`. */
    readonly tool: string
    /** The mode. */
    readonly mode: GrantMode
    /** The largest amount allowed alone, or null. */
    readonly limitVnd: number | null
    /** The argument constraints the call must keep to run alone. */
    readonly constraints: ReadonlyArray<ArgConstraint>
}

/** What the grant check decided for one call. */
export type GrantVerdict =
    | { readonly kind: "allow" }
    | { readonly kind: "refuse" }
    | { readonly kind: "approval"; readonly reason: ToolApprovalReason }

/** Outcome of an audited call. */
export type CallOutcome = "ok" | "error" | "refused" | "approval" | "timeout" | "circuit_open"

/** One audit line as the console reads it. */
export interface CallLogView {
    /** The id. */
    readonly id: string
    /** The full tool name. */
    readonly tool: string
    /** The agent's name, or empty. */
    readonly agentName: string
    /** The outcome. */
    readonly outcome: CallOutcome
    /** The failure code, or null. */
    readonly errorCode: string | null
    /** The masked arguments as JSON text. */
    readonly argsMasked: string
    /** The masked result summary. */
    readonly resultSummary: string
    /** The duration. */
    readonly durationMs: number
    /** Who approved, or null. */
    readonly approvedBy: string | null
    /** When, ISO. */
    readonly at: string
}

/** One grant row as the console reads it. */
export interface GrantView extends ToolGrant {
    /** The agent. */
    readonly agentId: string
    /** The agent's name. */
    readonly agentName: string
    /** The constraints as JSON text, for the console. */
    readonly constraintsJson: string
}

/** The state of a connector's breaker. */
export interface BreakerState {
    /** Closed (calls run), open (calls are refused) or half-open (one probe call runs, the others are refused). */
    readonly phase: BreakerPhase
    /** When the recent failures happened, epoch ms. */
    readonly failures: ReadonlyArray<number>
    /** Until when it stays open, epoch ms, or null when it is not open. */
    readonly openUntil: number | null
}

/** The phase of a connector's breaker. */
export type BreakerPhase = "closed" | "open" | "half_open"

/** What the breaker decides for one call now: whether it runs, and the state to keep. */
export interface BreakerGate {
    /** True when the call may run. */
    readonly allowed: boolean
    /** The state after the decision (an open breaker past its pause turns half-open for the one probe it lets through). */
    readonly state: BreakerState
}

/** Which audit lines the console reads. */
export interface CallLogQuery {
    /** The owner or manager asking, in the workspace. */
    readonly actor: ConnectionActor
    /** How many lines (1 to 200); absent or null means fifty. */
    readonly limit?: number | null | undefined
}

