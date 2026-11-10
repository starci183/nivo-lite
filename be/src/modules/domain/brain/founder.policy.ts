import type { WorkspaceRole } from "@modules/domain/workspace-members"
import type { FactDecision } from "./brain.contracts"

/**
 * Who may put a truth in force or take one out of force: the founder (the workspace owner) alone, until the approver policy the owner
 * deferred exists (2026-11-10: "approver = the founder for now"). A manager may still turn a proposal down or keep the value in force.
 */
export const FOUNDER: ReadonlyArray<WorkspaceRole> = ["owner"]

/** Who may work on the brain without changing what is in force: the founder and the managers. */
export const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The roles a decision on a fact needs: only turning a proposal down leaves what is in force as it is. */
export const rolesToDecide = (action: FactDecision["action"]): ReadonlyArray<WorkspaceRole> =>
    action === "reject" ? MANAGERS : FOUNDER
