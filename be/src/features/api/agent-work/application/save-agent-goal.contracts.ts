import type { AgentGoalStatus } from "@modules/domain/agent-work"

/** What add or change a goal of an agent takes. */
export interface SaveAgentGoalRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance. */
    readonly installationId: string
    /** The goal to change; null for a new one. */
    readonly goalId: string | null
    /** Short title. */
    readonly title: string
    /** Longer text. */
    readonly detail: string
    /** Where the goal stands. */
    readonly status: AgentGoalStatus
    /** When the goal is due, or null. */
    readonly dueAt: Date | null
}
