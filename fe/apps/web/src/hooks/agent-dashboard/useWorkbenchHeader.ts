import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSWRConfig } from "swr"
import { MODULE_REGISTRY, pickCopy } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import { navigation, PRODUCT_TIME_ZONE } from "@/modules/i18n"
import { useAgentDashboard } from "./useAgentDashboard"

/** The address of the workbench with its `?tab=` replaced (the other query parameters stay). */
const addressWithTab = (tab: string): string => {
    const query = new URLSearchParams(window.location.search)
    query.set("tab", tab)
    return `${window.location.pathname}?${query.toString()}`
}

/** What a workbench header needs: the agent, the tab selection and every word of the frame and of the common regions. */
export const useWorkbenchHeader = (module: ModuleKey, installationId: string | null | undefined, tab: string) => {
    const t = useTranslations("agentDashboard")
    const locale = useLocale()
    const format = useFormatter()
    const router = navigation.useRouter()
    const { mutate } = useSWRConfig()
    const dashboard = useAgentDashboard(module, installationId)
    const select = (id: string) => router.replace(addressWithTab(id), { scroll: false })
    const retry = useCallback(() => {
        void mutate((key) => {
            const head = Array.isArray(key) ? key[0] : key
            return (
                typeof head === "string" &&
                (head === "QUERY_AGENT_DASHBOARD_SWR" || head.startsWith(`QUERY_${module.toUpperCase()}_`))
            )
        })
        router.refresh()
    }, [module, mutate, router])
    const when = (iso: string | null | undefined) =>
        iso
            ? format.dateTime(new Date(iso), {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: PRODUCT_TIME_ZONE,
              })
            : ""
    return {
        data: dashboard.data,
        isLoading: dashboard.isLoading,
        moduleName: pickCopy(MODULE_REGISTRY[module].name, locale === "en" ? "en" : "vi"),
        selectedTab: tab,
        select,
        retry,
        t,
        when,
        labels: {
            commandChat: t("commandChat"),
            modeAutopilot: t("modeAutopilot"),
            modeAssist: t("modeAssist"),
            regionFailed: t("regionFailed"),
            regionFailedText: t("regionFailedText"),
            retry: t("retry"),
            ribbonAria: t("ribbonAria"),
            tabsLabel: t("tabsLabel"),
        },
    }
}
