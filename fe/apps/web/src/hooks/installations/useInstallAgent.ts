import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { mutate } from "swr"
import { useMutateInstallModuleSwr } from "@/hooks/swr/api/graphql/mutations/useMutateInstallModuleSwr"
import { QUERY_MODULE_INSTALLATIONS_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryModuleInstallationsSwr"
import type { ModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { agentHref } from "@/modules/installations"
import { useGraphQLWithToast } from "@/modules/toast"

/** What the install hook hands the block. */
interface InstallAgent {
    /** The key being installed now, null when idle. */
    readonly busyKey: ModuleKey | null
    /** Installs the agent with the key and opens it; a refusal is toasted by the server message. */
    readonly install: (key: ModuleKey) => Promise<void>
}

/** Installs an agent of the catalogue through the back end, revalidates the installed agents and opens the new one. */
export const useInstallAgent = (): InstallAgent => {
    const t = useTranslations("modulesCore")
    const router = navigation.useRouter()
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = useMutateInstallModuleSwr()
    const [busyKey, setBusyKey] = useState<ModuleKey | null>(null)
    const install = useCallback(
        async (key: ModuleKey) => {
            setBusyKey(key)
            const installed = await runGraphQL(() => trigger({ moduleKey: key }), { successMessage: t("installed") })
            if (installed === undefined) {
                setBusyKey(null)
                return
            }
            await mutate(QUERY_MODULE_INSTALLATIONS_SWR_KEY)
            router.push(agentHref(key, installed.installationId))
        },
        [runGraphQL, trigger, t, router],
    )
    return { busyKey, install }
}
