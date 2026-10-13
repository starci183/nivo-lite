import { isManager, useMember } from "@/hooks/member"
import type { ModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { agentHref } from "@/modules/installations"
import type { AgentTab } from "@/modules/installations"

const ALL_TABS: ReadonlyArray<AgentTab> = ["setup", "workbench", "settings"]
const FIRST_TAB: AgentTab = "setup"

/** The tabs of one agent instance (Setup only for owners and managers): the one the path names, and the way to open another. */
export const useInstanceTabs = (module: ModuleKey, installationId: string) => {
    const member = useMember()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const tabs = ALL_TABS.filter((tab) => tab !== FIRST_TAB || isManager(member))
    const selected = tabs.find((tab) => tab !== FIRST_TAB && pathname.endsWith(`/${tab}`)) ?? FIRST_TAB
    const open = (id: string) => {
        const tab = ALL_TABS.find((entry) => entry === id)
        if (tab !== undefined) router.push(agentHref(module, installationId, tab))
    }
    return { tabs, selected, open }
}
