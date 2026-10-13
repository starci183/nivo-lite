import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateRenameInstallationAgentSwr, useMutateRenameModuleInstallationSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { AGENT_NAME_MAX } from "./agentSettings.shared"
import { useRefreshInstallation } from "./useRefreshInstallation"

/**
 * Saves the name of an agent. The instance label of a multi-instance agent and its agent share the name, so renaming one renames the
 * other. Answers whether it worked; a failure was already toasted with the server message.
 */
export const useSaveAgentName = (installationId: string, isInstance: boolean) => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const renameAgent = useMutateRenameInstallationAgentSwr()
    const renameInstance = useMutateRenameModuleInstallationSwr()
    const refresh = useRefreshInstallation()
    const save = useCallback(
        async (name: string): Promise<boolean> => {
            if (isInstance) {
                const renamed = await runGraphQL(() => renameInstance.trigger({ installationId, name }), {
                    showSuccessToast: false,
                })
                if (renamed === undefined) return false
            }
            const agentName = isInstance ? name.trim().slice(0, AGENT_NAME_MAX) : name
            const done = await runGraphQL(() => renameAgent.trigger({ installationId, name: agentName }), {
                successMessage: t("saved"),
            })
            await refresh()
            return done !== undefined
        },
        [installationId, isInstance, runGraphQL, renameInstance, renameAgent, refresh, t],
    )
    return { save, isSaving: renameAgent.isMutating || renameInstance.isMutating }
}
