"use client"

import { useActiveWorkspace, useWorkspaceId } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryAgentDashboardSwr } from "@/hooks/swr"
import type { ModuleKey } from "@/modules/catalog"
import type { DataSlot } from "@/modules/types"
import { toAgentDashboard } from "./agentDashboard.shared"
import type { AgentDashboardView } from "./agentDashboard.shared"

/** The common regions of one module's workbench (waiting, done, connections, knowledge), read from the back end in the browser. */
export const useAgentDashboard = (
    module: ModuleKey,
    installationId: string | null,
    isActive = true,
): {
    readonly read: ReturnType<typeof useQueryAgentDashboardSwr>
    readonly slot: DataSlot<AgentDashboardView>
    readonly reload: () => void
} => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const workspaceId = useWorkspaceId()
    const report = useGraphQLWithToast()
    const read = useQueryAgentDashboardSwr(isActive ? activeWorkspaceId : undefined, { module, installationId })
    const reload = () => {
        read.mutate().catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
    }
    return {
        read,
        slot: mapSlot(slotOfSwr(read), (wire) => toAgentDashboard(wire, module, installationId, workspaceId)),
        reload,
    }
}
