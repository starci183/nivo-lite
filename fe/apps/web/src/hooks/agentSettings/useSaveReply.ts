import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateSaveHoldingMessageSwr, useMutateSaveReplyTimeoutSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRefreshInstallation } from "./useRefreshInstallation"

/** Saves the two reply settings of a chatbot, each on its own: how long a customer waits, and the holding message. */
export const useSaveReply = (installationId: string) => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const saveTimeout = useMutateSaveReplyTimeoutSwr()
    const saveHolding = useMutateSaveHoldingMessageSwr()
    const refresh = useRefreshInstallation()
    const timeout = useCallback(
        async (value: number): Promise<boolean> => {
            const done = await runGraphQL(() => saveTimeout.trigger({ installationId, value }), {
                successMessage: t("saved"),
            })
            await refresh()
            return done !== undefined
        },
        [installationId, runGraphQL, saveTimeout, refresh, t],
    )
    const holding = useCallback(
        async (value: string): Promise<boolean> => {
            const done = await runGraphQL(() => saveHolding.trigger({ installationId, value }), {
                successMessage: t("saved"),
            })
            await refresh()
            return done !== undefined
        },
        [installationId, runGraphQL, saveHolding, refresh, t],
    )
    return { timeout, holding, isSaving: saveTimeout.isMutating || saveHolding.isMutating }
}
