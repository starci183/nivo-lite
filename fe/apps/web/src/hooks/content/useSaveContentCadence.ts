import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useContentRefresh } from "./useContentRefresh"
import { useMutateSaveContentCadenceSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveContentCadenceSwr"
import type { MutateSaveContentCadenceRequest } from "@/modules/api/graphql/mutations/mutation-save-content-cadence"
import { useGraphQLWithToast } from "@/modules/toast"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useSaveContentCadence = () => {
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateSaveContentCadenceSwr()
    const { refresh } = useContentRefresh()
    const save = useCallback(
        async (request: MutateSaveContentCadenceRequest) => {
            const result = await runGraphQL(() => trigger(request), { successMessage: t("saveDone") })
            if (result !== undefined) await refresh()
            return result
        },
        [refresh, runGraphQL, t, trigger],
    )
    return { save, isMutating }
}
