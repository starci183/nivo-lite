import type { InstallationLifecycle, InstallationRecord } from "./module-installations.contracts"

/** The facts of an installation the lifecycle reads. */
type LifecycleFacts = Pick<InstallationRecord, "activeContextVersionId" | "liveEnabled" | "status">

/**
 * What the product may say about an installation. A removed agent is removed whatever else is stored. An agent without an applied context version has nothing confirmed to run on, so it
 * needs setup whatever the stored status says; the owner's pause comes next; a missing required connection is read from the facts
 * now, not from the stored status (the stored `needs_connection` is only settled the next time the agent is asked to run); then the
 * agent is `running` only when the owner switched it on, otherwise `ready`.
 */
export const lifecycleOf = (facts: LifecycleFacts, missingConnections: number): InstallationLifecycle => {
    if (facts.status === "removed") return "removed"
    if (facts.activeContextVersionId === null) return "needs_setup"
    if (facts.status === "paused") return "paused"
    if (missingConnections > 0) return "needs_connection"
    const switchedOn = facts.liveEnabled && (facts.status === "live" || facts.status === "needs_connection")
    return switchedOn ? "running" : "ready"
}
