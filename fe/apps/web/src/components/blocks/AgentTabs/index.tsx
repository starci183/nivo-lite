"use client"

import { navigation } from "@/modules/i18n"
import { AgentTabsBase } from "./component"

/** One tab with the page it opens. */
type AgentTab = { readonly id: string; readonly label: string; readonly href: string }

/** What the frame of an agent hands the tabs. */
type AgentTabsProps = {
    readonly label: string
    readonly tabs: ReadonlyArray<AgentTab>
}

const FIRST_TAB = "setup"

/** The connected tabs of an agent: the tab that matches the current path is selected (Setup otherwise), and a tab opens its page. */
export const AgentTabs = (props: AgentTabsProps) => {
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const selected = props.tabs.find((tab) => tab.id !== FIRST_TAB && pathname.endsWith(`/${tab.id}`))?.id ?? FIRST_TAB
    return (
        <AgentTabsBase
            props={{ label: props.label, tabs: props.tabs, selected }}
            on={{
                select: (id) => {
                    const target = props.tabs.find((tab) => tab.id === id)
                    if (target !== undefined) router.push(target.href)
                },
            }}
        />
    )
}
