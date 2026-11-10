import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { rightsGaps } from "@nivo-lite/agent-sdk/rights"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import { workflowDiffOf } from "./workflow-diff.policy"

/**
 * Whether a new snapshot gives the agent more reach than the one running: any right the running grant does not cover (a new kind,
 * access or field, or a `turn` right made `workspace`), or any tool or effect it does not hold.
 */
export const widens = (running: GraphSpec, next: GraphSpec): boolean => {
    const { grant } = workflowDiffOf(running, next)
    return (
        rightsGaps(running.grant, next.grant.rights).length > 0 ||
        grant.toolsAdded.length > 0 ||
        grant.effectsAdded.length > 0
    )
}

/** Refuses a snapshot that widens the agent unless the owner publishes it; a manager may only keep or narrow the reach. */
export const requireNoWidening = (running: GraphSpec, next: GraphSpec, role: "owner" | "manager"): void => {
    if (role !== "owner" && widens(running, next)) {
        throw new AgentGraphsError({ code: AgentGraphsErrorCode.WidensNeedsOwner })
    }
}
