import type { LensLanes } from "@modules/domain/agents"
import type { KnowledgeAudience } from "./agent-knowledge.contracts"
import { viewOf } from "./knowledge-view.policy"

/** The kinds of shared knowledge a view can open or close. */
export type KnowledgeLane = keyof LensLanes

/** The module the public's view is asked as: a customer-facing one, so the view is the public one whatever else is asked. */
export const CUSTOMER_MODULE = "chatbot"

/**
 * Whether a view of this audience reads the lane: public documents and facts are read by everyone, internal ones by the team's view
 * only, and restricted facts by the team's view and then only when the fact names the agent's module.
 */
export const laneOpenTo = (audience: KnowledgeAudience, lane: KnowledgeLane): boolean =>
    lane === "documentPublic" || lane === "factPublic" || audience === "internal"

/** Which lanes the view of a module reads; `audience` can only narrow what the module may read. */
export const lanesOfView = (module: string, audience?: KnowledgeAudience): LensLanes => {
    const seen = viewOf({ workspaceId: "", module, ...(audience === undefined ? {} : { audience }) }).audience
    return {
        documentPublic: laneOpenTo(seen, "documentPublic"),
        documentInternal: laneOpenTo(seen, "documentInternal"),
        factPublic: laneOpenTo(seen, "factPublic"),
        factInternal: laneOpenTo(seen, "factInternal"),
        factRestricted: laneOpenTo(seen, "factRestricted"),
    }
}
