import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useContentRefresh } from "./useContentRefresh"
import { useMutateSaveContentBrandSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveContentBrandSwr"
import type { MutateSaveContentBrandRequest } from "@/modules/api/graphql/mutations/mutation-save-content-brand"
import { useGraphQLWithToast } from "@/modules/toast"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useSaveContentBrand = () => {
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateSaveContentBrandSwr()
    const { refresh } = useContentRefresh()
    const save = useCallback(
        async (request: MutateSaveContentBrandRequest) => {
            const result = await runGraphQL(() => trigger(request), { successMessage: t("saveDone") })
            if (result !== undefined) await refresh()
            return result
        },
        [refresh, runGraphQL, t, trigger],
    )
    return { save, isMutating }
}
