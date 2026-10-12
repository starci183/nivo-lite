import type { OptionalAgentIdentity } from "./decisions.contracts"
import type { OptionalId } from "./decisions-views.contracts"

/** The one door to the agents capability: which agent speaks for a department. The app root binds it. */
export interface AgentDirectory {
    /**
     * The agent that speaks for a department on an item: the item's own instance's agent when `installationId` names one,
     * else the department's first active agent; null when neither exists.
     */
    agentOfDepartment(
        workspaceId: string,
        department: string,
        installationId: OptionalId,
    ): Promise<OptionalAgentIdentity>
}
