"use client"

import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentPageSwr } from "@/hooks/swr"
import type { DataSlot } from "@/modules/types"
import { toAgentProfile } from "./agentProfile.shared"
import type { AgentProfileView } from "./agentProfile.shared"

/** The profile page of one agent, read from the back end in the browser. */
export const useAgentProfile = (
    agentId: string,
): { readonly slot: DataSlot<AgentProfileView>; readonly reload: () => void } => {
    const read = useQueryAgentPageSwr({ agentId })
    const view = useMemo(() => (read.data === undefined ? undefined : toAgentProfile(read.data)), [read.data])
    return {
        slot: slotOfSwr({ data: view, error: read.error, isLoading: read.isLoading }),
        reload: () => void read.mutate(),
    }
}
