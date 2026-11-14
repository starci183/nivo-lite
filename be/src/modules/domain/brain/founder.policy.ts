import type { WorkspaceRole } from "@modules/domain/workspace-members"
import type { FactDecision } from "./brain.contracts"

/**
 * Who may put a truth in force or take one out of force: the founder (the workspace owner) alone, until the approver policy the owner
 * deferred exists (2026-11-10: "approver = the founder for now"). A manager may still turn a proposal down or keep the value in force.
 */
export const FOUNDER: ReadonlyArray<WorkspaceRole> = ["owner"]

/** Who may work on the brain without changing what is in force: the founder and the managers. */
export const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/**
 * The roles a decision on a fact needs: turning a proposal down leaves what is in force as it is; a SPLIT is open to a manager too, but a
 * manager's split only files the situational value as a proposal for the founder (`splitInForce`), while the founder's split is the
 * approval and puts it in force.
 */
export const rolesToDecide = (action: FactDecision["action"]): ReadonlyArray<WorkspaceRole> =>
    action === "reject" || action === "split" ? MANAGERS : FOUNDER

/** Whether a split by this role puts the situational value in force at once (the founder's decision) or files it as a proposal. */
export const splitInForce = (role: WorkspaceRole): boolean => FOUNDER.includes(role)
