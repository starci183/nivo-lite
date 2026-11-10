"use client"

import { useCallback } from "react"
import { useMutateRenameInstallationAgentSwr } from "@/hooks/swr"
import { useSettingSaved } from "./useSettingSaved"

/** The view `useSaveAgentName` returns. */
export interface SaveAgentNameView {
    save: (name: string) => Promise<boolean>
    isSaving: boolean
}

/**
 * Saves the display name of an agent. An agent has one name for every type, instance or not: the one the header, Office and
 * the chat show. Answers whether it worked; a failure was already toasted with the server message.
 */
export const useSaveAgentName = (installationId: string): SaveAgentNameView => {
    const settingSaved = useSettingSaved()
    const renameAgent = useMutateRenameInstallationAgentSwr()
    const save = useCallback(
        (name: string): Promise<boolean> => settingSaved(() => renameAgent.trigger({ installationId, name })),
        [installationId, settingSaved, renameAgent],
    )
    return { save, isSaving: renameAgent.isMutating }
}
