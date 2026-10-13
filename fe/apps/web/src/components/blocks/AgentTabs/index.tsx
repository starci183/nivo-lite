"use client"

import { useTranslations } from "next-intl"
import { useInstanceTabs } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { AgentTabsBase } from "./component"

/** What the layout hands the tabs: the type and the instance of the url. */
interface AgentTabsProps {
    readonly module: ModuleKey
    readonly installationId: string
}

/** The connected tabs of an agent: the tab that matches the current path is selected (Setup otherwise), and a tab opens its page. */
export const AgentTabs = (props: AgentTabsProps) => {
    const t = useTranslations("modulesCore")
    const { tabs, selected, open } = useInstanceTabs(props.module, props.installationId)
    return (
        <AgentTabsBase
            props={{
                label: t("tabsLabel"),
                tabs: tabs.map((tab) => ({ id: tab, label: t(`tab_${tab}`) })),
                selected,
            }}
            on={{ select: open }}
        />
    )
}
