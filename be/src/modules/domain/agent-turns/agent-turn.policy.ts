import type { AgentWakeSource, AgentWorkState } from "@modules/domain/agent-work"
import { backgroundCapSpent, breakerOpen, isBackground } from "@modules/domain/agent-work"
import type {
    AgentTurnBlock,
    OptionalReadiness,
    OptionalRunningInstallation,
    OptionalStopReason,
} from "./agent-turns.contracts"

/** The usage kind a customer turn on the core road is metered under, the same as on the legacy road. */
const CUSTOMER_KIND = "chat_reply"

/** The usage kind every other turn is metered under. */
const WORK_KIND = "agent_work"

/** How long a tag turn may take, in milliseconds. */
export const TAG_TURN_MS = 60_000

/** How long a background turn may take, in milliseconds. */
export const BACKGROUND_TURN_MS = 120_000

/** The socket gets a little longer than the turn, so the runtime's own timeout answers first. */
export const ABORT_GRACE_MS = 5000

/** Vietnam is UTC+7 all year: the day of the background count is the day there. */
const VIETNAM_OFFSET_MS = 7 * 60 * 60_000

/** What the executor stores as the proposal of a turn: the model's text, read by the handler of the source. */
export interface StoredProposal {
    /** The final assistant text. */
    readonly text: string
}

/** The usage kind a turn of this source is metered under. */
export const usageKindFor = (source: AgentWakeSource): string => (source === "customer" ? CUSTOMER_KIND : WORK_KIND)

/** How long a turn that is not a customer's may take. */
export const internalTimeoutMsOf = (source: AgentWakeSource): number =>
    source === "tag" ? TAG_TURN_MS : BACKGROUND_TURN_MS

/** The day (`YYYY-MM-DD`) of a moment in Vietnam time, the day the background count is kept by. */
export const vietnamDayOf = (now: Date): string =>
    new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)

/**
 * Why a turn must not run, from the agent's state: the breaker holds customer and background turns (a customer goes straight to the
 * holding line, background work waits), and the day's cap holds background turns only. A tag is never held by either.
 */
export const stateBlockOf = (
    source: AgentWakeSource,
    state: AgentWorkState,
    cap: number,
    now: Date,
): Extract<AgentTurnBlock, "breaker" | "daily_cap"> | null => {
    if ((source === "customer" || isBackground(source)) && breakerOpen(state.breakerUntil, now)) return "breaker"
    if (isBackground(source) && backgroundCapSpent(state, cap, vietnamDayOf(now))) return "daily_cap"
    return null
}

/** The proposal the executor stores for the text a model answered. */
export const storedProposalOf = (text: string): StoredProposal => ({ text })

/** The model's text out of a stored proposal; an empty text for anything else. */
export const proposalTextOf = (proposal: unknown): string => {
    if (typeof proposal !== "object" || proposal === null || !("text" in proposal)) return ""
    return typeof proposal.text === "string" ? proposal.text : ""
}

/** The installation status in which an agent runs. */
const LIVE = "live"

/**
 * Why an agent's installation does not run, or null when it does: its required connections are missing, or it is not live (still
 * installing, in setup, paused, or without an applied version the owner switched on). An agent with no installation has nothing to wait for.
 * `status` is what the module readiness settled for the installation, or null when the agent has none.
 */
export const stoppedBy = (status: OptionalReadiness, installation: OptionalRunningInstallation): OptionalStopReason => {
    if (status !== null && status !== LIVE)
        return status === "needs_connection" ? "needs_connection" : "installation_not_running"
    if (installation !== null && (installation.activeContextVersionId === null || !installation.liveEnabled)) {
        return "installation_not_running"
    }
    return null
}
