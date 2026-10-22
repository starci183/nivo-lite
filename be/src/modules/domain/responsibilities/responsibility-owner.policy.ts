import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { ResponsibilitiesErrorCode } from "./errors/responsibilities.error"

/** An agent of the workspace as an owner is chosen among them. */
export interface OwnerAgent {
    /** The agent id. */
    readonly id: string
    /** The agent display name. */
    readonly name: string
}

/** An active member of the workspace as an owner is chosen among them. */
export interface OwnerMember {
    /** The member id (the id of the seat, not of the Auth account). */
    readonly id: string
    /** The member display name. */
    readonly display_name: string
}

/** Who owns a step after the choice was judged: one concrete member or one agent. */
export interface ResolvedOwner {
    /** `human` for a member, `agent` for an agent. */
    readonly kind: "human" | "agent"
    /** The agent that owns the step; null for a person. */
    readonly agentId: string | null
    /** The member that owns the step; null for an agent. */
    readonly memberId: string | null
    /** The name shown as owner. */
    readonly name: string
}

/** What the lookups found for a chosen owner id: the active member, the agent, or neither. */
export interface OwnerCandidates {
    /** The active member of the workspace the id names. */
    readonly member?: OwnerMember
    /** The agent of the workspace the id names. */
    readonly agent?: OwnerAgent
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when a chosen owner can name a row at all: owners are ids, never labels such as the old generic "human". */
export const isOwnerId = (owner: string): boolean => UUID.test(owner)

/** Judges a chosen owner: a concrete member of the workspace first, else an agent of it; anything else is refused. */
export const resolveOwner = (
    owner: string,
    found: OwnerCandidates,
): Outcome<ResolvedOwner, ResponsibilitiesErrorCode> => {
    if (found.member !== undefined) {
        return ok({ kind: "human", agentId: null, memberId: found.member.id, name: found.member.display_name })
    }
    if (found.agent !== undefined) {
        return ok({ kind: "agent", agentId: found.agent.id, memberId: null, name: found.agent.name })
    }
    return refused(ResponsibilitiesErrorCode.OwnerNotFound, { id: owner })
}
