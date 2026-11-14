"use client"

import { useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { useWorkspaceId } from "@/hooks/workspaces"
import { PROVIDER_PAGE_TABS, providerPageTabOfPath, providerPageTabPath } from "@/modules/connection-page"
import { navigation } from "@/modules/i18n"
import { workspaceHref } from "@/modules/routes"
import type { ProviderPageTab, ProviderPageTabsView } from "@/modules/types"

/** The catalog key of each tab's name. */
const TAB_KEYS = {
    config: "tabConfig",
    rights: "tabRights",
    api: "tabApi",
    mcp: "tabMcp",
    trigger: "tabTrigger",
} as const satisfies Readonly<Record<ProviderPageTab, string>>

/**
 * The tabs of a connected account's page (Cau hinh, Quyen, API, MCP, Trigger, in that order) as links of their own addresses
 * (`/connections/open/<id>[/<tab>]`), and the one the address opens: Cau hinh when the address is the page itself.
 */
export const useProviderPageTabs = (): ProviderPageTabsView => {
    const t = useTranslations("providerPage")
    const workspaceId = useWorkspaceId()
    const params = useParams<{ id?: string }>()
    const pathname = navigation.usePathname()
    const connectionId = typeof params.id === "string" ? params.id : ""
    return {
        label: t("tabsLabel"),
        selectedKey: providerPageTabOfPath(pathname),
        items: PROVIDER_PAGE_TABS.map((id) => ({
            id,
            label: t(TAB_KEYS[id]),
            href: workspaceHref(workspaceId, providerPageTabPath(connectionId, id)),
        })),
    }
}
