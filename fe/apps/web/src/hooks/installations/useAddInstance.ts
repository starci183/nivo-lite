"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "@/modules/viewer-cache"
import { useMutateInstallModuleSwr, QUERY_MODULE_INSTALLATIONS_SWR_KEY } from "@/hooks/swr"
import type { ModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { agentHref, cleanInstanceName } from "@/modules/installations"
import { useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"

/** Adds another instance of a multi-instance agent type through the back end and opens it on its Setup tab. */
export const useAddInstance = () => {
    const t = useTranslations("modulesCore")
    const router = navigation.useRouter()
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateInstallModuleSwr()
    const add = useCallback(
        async (moduleKey: ModuleKey, text: string): Promise<boolean> => {
            const name = cleanInstanceName(text)
            if (name === null) return false
            const added = await runGraphQL(() => trigger({ moduleKey, name, newInstance: true }), {
                successMessage: t("instanceCreated"),
            })
            if (added === undefined) return false
            await mutate(matchesSwrKey(QUERY_MODULE_INSTALLATIONS_SWR_KEY))
            router.push(agentHref(moduleKey, added.installationId))
            return true
        },
        [runGraphQL, trigger, t, router],
    )
    return { add, isAdding: isMutating }
}
