import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useGraphQLWithToast } from "@/modules/toast"
import { useContentRefresh } from "./useContentRefresh"

/** Runs one content configuration write: toasts its outcome and refreshes the content data when it went through. */
export const useContentSave = <TArgs extends unknown[], TResult>(trigger: (...args: TArgs) => Promise<TResult>) => {
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const { refresh } = useContentRefresh()
    return useCallback(
        async (...args: TArgs) => {
            const result = await runGraphQL(() => trigger(...args), { successMessage: t("saveDone") })
            if (result !== undefined) await refresh()
            return result
        },
        [refresh, runGraphQL, t, trigger],
    )
}
