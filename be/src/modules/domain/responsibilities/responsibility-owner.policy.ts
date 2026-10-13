import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { HUMAN_OWNER } from "./responsibilities.contracts"

/** An agent of the workspace as an owner is chosen among them. */
export interface OwnerAgent {
    /** The agent id. */
    readonly id: string
    /** The agent display name. */
    readonly name: string
}

/** Who owns a step after the choice was judged: the signed-in person or one agent. */
export interface ResolvedOwner {
    /** `human` or `agent`. */
    readonly kind: "human" | "agent"
    /** The agent that owns the step; null for a person. */
    readonly agentId: string | null
    /** The name shown as owner. */
    readonly name: string
}

/** The id of the agent a chosen owner names; null when the owner is the signed-in person and nothing needs looking up. */
export const agentToLookUp = (owner: string): string | null => (owner === HUMAN_OWNER ? null : owner)

/** Judges a chosen owner: the signed-in person, or an agent that must exist in the workspace. */
export const resolveOwner = (
    owner: string,
    agent: OwnerAgent | undefined,
    actorName: string,
): Outcome<ResolvedOwner, ResponsibilitiesErrorCode> => {
    if (owner === HUMAN_OWNER) return ok({ kind: "human", agentId: null, name: actorName })
    if (agent === undefined) return refused(ResponsibilitiesErrorCode.AgentNotFound, { id: owner })
    return ok({ kind: "agent", agentId: agent.id, name: agent.name })
}
