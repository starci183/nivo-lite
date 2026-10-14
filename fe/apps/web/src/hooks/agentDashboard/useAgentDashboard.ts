"use client"

import { useMemo } from "react"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentDashboardSwr } from "@/hooks/swr"
import type { ModuleKey } from "@/modules/catalog"
import type { DataSlot } from "@/modules/types"
import { toAgentDashboard } from "./agentDashboard.shared"
import type { AgentDashboardView } from "./agentDashboard.shared"

/** The common regions of one module's workbench (waiting, done, connections, knowledge), read from the back end in the browser. */
export const useAgentDashboard = (
    module: ModuleKey,
    installationId: string | null,
): { readonly slot: DataSlot<AgentDashboardView>; readonly reload: () => void } => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const read = useQueryAgentDashboardSwr(activeWorkspaceId, { module, installationId })
    const view = useMemo(
        () => (read.data === undefined ? undefined : toAgentDashboard(read.data, module, installationId)),
        [read.data, module, installationId],
    )
    const reload = () => void read.mutate()
    return { slot: slotOfSwr({ data: view, error: read.error, isLoading: read.isLoading }), reload }
}
