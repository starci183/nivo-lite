import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"
import { QUERY_AUTHORITY_SWR_KEY, useMutateUpdateAuthoritySwr } from "@/hooks/swr"
import type { MutateUpdateAuthorityRequest } from "@/modules/api/graphql/mutations/mutation-update-authority"
import { useGraphQLWithToast } from "@/modules/toast"

/** The profile fields one section writes (the back end keeps the rest). */
export type AuthorityPatch = MutateUpdateAuthorityRequest["patch"]

/** Saves part of the authority profile through the back end and toasts the outcome; the sheet is read again on success. */
export const useSaveAuthority = () => {
    const t = useTranslations("authority")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateUpdateAuthoritySwr()
    const save = useCallback(
        async (patch: AuthorityPatch): Promise<boolean> => {
            const saved = await runGraphQL(() => trigger({ patch }), { successMessage: t("saved") })
            if (saved === undefined) return false
            await mutate(QUERY_AUTHORITY_SWR_KEY)
            return true
        },
        [runGraphQL, trigger, t],
    )
    return { save, isSaving: isMutating }
}
