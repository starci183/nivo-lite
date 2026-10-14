"use client"

import { useMemo } from "react"
import { useInstallations } from "@/hooks/installations"
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
    const { slot, reload } = useInstallations()
    const found = useMemo(() => {
        const one = slot.items?.find((installation) => installation.id === installationId)
        return one?.moduleKey === moduleKey ? one : undefined
    }, [slot, installationId, moduleKey])
    const slotOfOne = useMemo((): DataSlot<AgentInstallationView> => {
        if (found !== undefined) return { items: toAgentInstallationView(found) }
        return slot.isLoading === true ? { isLoading: true } : { isError: true }
    }, [found, slot])
    return { slot: slotOfOne, installation: found, reload }
}
