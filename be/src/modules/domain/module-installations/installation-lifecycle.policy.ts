import type { InstallationLifecycle, InstallationRecord } from "./module-installations.contracts"

/** The facts of an installation the lifecycle reads. */
type LifecycleFacts = Pick<InstallationRecord, "activeContextVersionId" | "liveEnabled" | "status">

/**
 * What the product may say about an installation: the one state every screen reads. A removed agent is removed whatever else is
 * stored. An agent without an applied context version has nothing confirmed to run on, so it never reads as paused, ready or running
 * whatever the stored status says: it is `needs_setup` while no setup gate is confirmed and `setting_up` once the owner has begun. The
 * owner's pause comes next; a missing required connection is read from the facts now, not from the stored status (the stored
 * `needs_connection` is only settled the next time the agent is asked to run); then the agent is `running` only when the owner switched
 * it on, otherwise `ready`.
 */
export const lifecycleOf = (
    facts: LifecycleFacts,
    missingConnections: number,
    confirmedGates: number,
): InstallationLifecycle => {
    if (facts.status === "removed") return "removed"
    if (facts.activeContextVersionId === null) return confirmedGates > 0 ? "setting_up" : "needs_setup"
    if (facts.status === "paused") return "paused"
    if (missingConnections > 0) return "needs_connection"
    const switchedOn = facts.liveEnabled && (facts.status === "live" || facts.status === "needs_connection")
    return switchedOn ? "running" : "ready"
}
