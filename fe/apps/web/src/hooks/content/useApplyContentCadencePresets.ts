import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useContentRefresh } from "./useContentRefresh"
import { useMutateApplyContentCadencePresetsSwr } from "@/hooks/swr/api/graphql/mutations/useMutateApplyContentCadencePresetsSwr"
import { useGraphQLWithToast } from "@/modules/toast"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useApplyContentCadencePresets = () => {
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateApplyContentCadencePresetsSwr()
    const { refresh } = useContentRefresh()
    const apply = useCallback(async () => {
        const result = await runGraphQL(() => trigger(), { successMessage: t("saveDone") })
        if (result !== undefined) await refresh()
        return result
    }, [refresh, runGraphQL, t, trigger])
    return { apply, isMutating }
}
