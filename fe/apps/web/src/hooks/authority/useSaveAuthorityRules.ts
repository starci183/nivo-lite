"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "@/modules/viewer-cache"
import { QUERY_AUTHORITY_SWR_KEY, useMutateSaveAuthorityRuleSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"
import type { RuleChange } from "@/modules/authority"

/** Writes the edited authority rules through the back end (one write per rule) and toasts the outcome once; the sheet is read again. */
export const useSaveAuthorityRules = () => {
    const t = useTranslations("authority")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateSaveAuthorityRuleSwr()
    const save = useCallback(
        async (changes: ReadonlyArray<RuleChange>): Promise<boolean> => {
            const done = await runGraphQL(
                () =>
                    Promise.all(
                        changes.map((change) =>
                            trigger({
                                change: {
                                    action: change.action,
                                    department: change.department,
                                    mode: change.mode,
                                    limit_vnd: change.limit,
                                    required_fields: [...change.required],
                                },
                            }),
                        ),
                    ),
                { successMessage: t("saved") },
            )
            await mutate(matchesSwrKey(QUERY_AUTHORITY_SWR_KEY))
            return done !== undefined
        },
        [runGraphQL, trigger, t],
    )
    return { save, isSaving: isMutating }
}
