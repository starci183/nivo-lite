"use client"

import { useParams } from "next/navigation"
import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentPageSwr } from "@/hooks/swr"
import { isInvalidFailure, isNotFoundFailure } from "@/modules/failure"
import type { DataSlot } from "@/modules/types"
import { toAgentProfile, type AgentProfileView } from "./agentProfile.shared"

/**
 * The profile page of one agent, read from the back end in the browser. An empty id comes from the profile's loading route, which knows
 * no params: the agent is then the one the address names. `isMissing` is true once the back end says no such agent exists (an id that
 * is no agent id of the workspace, such as an installation id): the page then answers `notFound()`.
 */
export const useAgentProfile = (
    given: string | null,
): { readonly slot: DataSlot<AgentProfileView>; readonly isMissing: boolean; readonly reload: () => void } => {
    const params = useParams<{ agentId?: string }>()
    const agentId = given === "" ? (params.agentId ?? null) : given
    const read = useQueryAgentPageSwr(agentId === null ? null : { agentId })
    const view = useMemo(() => (read.data === undefined ? undefined : toAgentProfile(read.data)), [read.data])
    return {
        slot: slotOfSwr({ data: view, error: read.error, isLoading: read.isLoading }),
        isMissing: read.error !== undefined && (isNotFoundFailure(read.error) || isInvalidFailure(read.error)),
        reload: () => void read.mutate(),
    }
}
