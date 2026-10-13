import { useQueryAgentDashboardSwr } from "@/hooks/swr/api/graphql/queries/useQueryAgentDashboardSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { AgentDashboardInput } from "@/modules/api"
import { agentDashboardViewOf } from "./agentDashboard.shared"
import type { AgentDashboardViewOptions } from "./agentDashboard.shared"

/** The agent dashboard of the active workspace for one module, mapped to the frame's presentation model. */
export const useAgentDashboard = (request: AgentDashboardInput, options: AgentDashboardViewOptions) => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQueryAgentDashboardSwr(activeWorkspaceId, request)
    return {
        /** What the frame draws; undefined until the dashboard is read. */
        view: query.data === undefined ? undefined : agentDashboardViewOf(query.data, options),
        isLoading: query.isLoading,
        error: query.error,
        retry: () => {
            void query.mutate()
        },
    }
}
