import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useContentRefresh } from "./useContentRefresh"
import { useMutateSaveContentPillarsSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveContentPillarsSwr"
import type { MutateSaveContentPillarsRequest } from "@/modules/api/graphql/mutations/mutation-save-content-pillars"
import { useGraphQLWithToast } from "@/modules/toast"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useSaveContentPillars = () => {
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateSaveContentPillarsSwr()
    const { refresh } = useContentRefresh()
    const save = useCallback(
        async (request: MutateSaveContentPillarsRequest) => {
            const result = await runGraphQL(() => trigger(request), { successMessage: t("saveDone") })
            if (result !== undefined) await refresh()
            return result
        },
        [refresh, runGraphQL, t, trigger],
    )
    return { save, isMutating }
}
