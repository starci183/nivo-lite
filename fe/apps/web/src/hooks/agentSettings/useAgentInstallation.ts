"use client"

import { useMemo } from "react"
import { useInstallations } from "@/hooks/installations"
import { slotOfSwr } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { Installation } from "@/modules/installations"
import type { DataSlot } from "@/modules/types"
import { toAgentInstallationView } from "./agentSettings.shared"
import type { AgentInstallationView } from "./agentSettings.shared"

/**
 * One installed agent of the active workspace, from the installations the other screens share. An instance that does not exist, or that
 * belongs to another type than the url names, reads as a failure.
 */
export const useAgentInstallation = (
    installationId: string,
    moduleKey: string,
): {
    readonly slot: DataSlot<AgentInstallationView>
    /** The whole installation, for the extra card of a module that still draws from it. */
    readonly installation: Installation | undefined
    readonly reload: () => void
} => {
    const { installations, read, reload } = useInstallations()
    const workspaceId = useWorkspaceId()
    const found = useMemo(() => {
        const one = installations?.find((installation) => installation.id === installationId)
        return one?.moduleKey === moduleKey ? one : undefined
    }, [installations, installationId, moduleKey])
    const slotOfOne = slotOfSwr({
        data: found === undefined ? undefined : toAgentInstallationView(found, workspaceId),
        error:
            installations !== undefined && found === undefined
                ? new Error("Requested agent installation does not exist")
                : read.error,
        isLoading: read.isLoading,
        isValidating: read.isValidating,
    })
    return { slot: slotOfOne, installation: found, reload }
}
