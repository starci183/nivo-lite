"use client"

import { QUERY_AUTHORITY_SWR_KEY, useMutateUpdateAuthoritySwr } from "@/hooks/swr"
import type { MutateUpdateAuthorityRequest } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"
import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "@/modules/viewer-cache"

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
            await mutate(matchesSwrKey(QUERY_AUTHORITY_SWR_KEY))
            return true
        },
        [runGraphQL, trigger, t],
    )
    return { save, isSaving: isMutating }
}
