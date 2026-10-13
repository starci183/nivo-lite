import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useContentRefresh } from "./useContentRefresh"
import { useMutateSetContentAutomationSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSetContentAutomationSwr"
import type { MutateSetContentAutomationRequest } from "@/modules/api/graphql/mutations/mutation-set-content-automation"
import { useGraphQLWithToast } from "@/modules/toast"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useSetContentAutomation = () => {
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateSetContentAutomationSwr()
    const { refresh } = useContentRefresh()
    const set = useCallback(
        async (request: MutateSetContentAutomationRequest) => {
            const result = await runGraphQL(() => trigger(request), { successMessage: t("saveDone") })
            if (result !== undefined) await refresh()
            return result
        },
        [refresh, runGraphQL, t, trigger],
    )
    return { set, isMutating }
}
