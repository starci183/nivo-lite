"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useRefreshInstallation } from "@/hooks/agentSettings"
import { useMutateRemoveAgentSwr, useMutateSetModuleLiveSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/** The commands of one agent card. */
export interface AgentCardActions {
    /** Pauses or resumes the agent; a failure was already toasted. */
    readonly setLive: (installationId: string, live: boolean) => Promise<void>
    /** Removes the agent for good (its history stays); a failure was already toasted. */
    readonly remove: (installationId: string) => Promise<void>
    readonly isBusy: boolean
}

/** The pause, resume and remove commands the menu of an agent card runs, by installation id. */
export const useAgentCardActions = (): AgentCardActions => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const live = useMutateSetModuleLiveSwr()
    const removal = useMutateRemoveAgentSwr()
    const refresh = useRefreshInstallation()
    const setLive = useCallback(
        async (installationId: string, isLive: boolean): Promise<void> => {
            await runGraphQL(() => live.trigger({ installationId, live: isLive }), { successMessage: t("saved") })
            await refresh()
        },
        [runGraphQL, live, refresh, t],
    )
    const remove = useCallback(
        async (installationId: string): Promise<void> => {
            await runGraphQL(() => removal.trigger({ installationId }), { successMessage: t("removed") })
            await refresh()
        },
        [runGraphQL, removal, refresh, t],
    )
    return { setLive, remove, isBusy: live.isMutating || removal.isMutating }
}
