import type { WorkContext } from "./decisions.contracts"

/** An id, or null when there is none. */
export type OptionalLineId = string | null

/** The agent that speaks for a department. */
export interface AgentIdentity {
    /** The agent id. */
    readonly id: string
    /** The display name. */
    readonly name: string
}

/** An agent identity, or null when the department has no agent. */
export type OptionalAgentIdentity = AgentIdentity | null

/** The one door to the agents capability: which agent speaks for a department. The app root binds it. */
export interface WorkAgentDirectory {
    /**
     * The agent that speaks for a department on an item: the item's own instance's agent when `installationId` names one, else the
     * department's first active agent; null when neither exists.
     */
    agentOfDepartment(
        workspaceId: string,
        department: string,
        installationId: OptionalLineId,
    ): Promise<OptionalAgentIdentity>
}

/** One line the work engine says to people in the team chat. */
export interface WorkLine {
    /** The words, from the caller's message catalog. */
    readonly body: string
    /** The department whose agent speaks; none lets the line be said by `agentId`, else by nobody. */
    readonly department?: string | undefined
    /** The instance of the department whose agent speaks. */
    readonly installationId?: OptionalLineId | undefined
    /** The agent that speaks, when it is known. */
    readonly agentId?: OptionalLineId | undefined
    /** Team-chat rooms the line goes to; none sends it to the owner's direct room with the speaking agent. */
    readonly roomIds?: ReadonlyArray<string> | undefined
    /** Makes a retry of the same line the same line. */
    readonly key?: OptionalLineId | undefined
}

/** What the line service needs of the engine's context. */
export type WorkLineScope = Pick<WorkContext, "workspaceId">

/** Where the approval card of a decision stands: how many rooms the approval hook posted it to. The root binds the team chat. */
export interface WorkAskCards {
    /** In how many rooms the approval card of the decision stands; 0 when no card was posted (no request opened, or nobody to show it to). */
    cardRooms(workspaceId: string, decisionId: string): Promise<number>
}
