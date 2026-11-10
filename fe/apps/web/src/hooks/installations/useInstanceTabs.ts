import { isManager, useMember } from "@/hooks/member"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { ModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { agentHref } from "@/modules/installations"
import type { AgentTab } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"

const ALL_TABS: ReadonlyArray<AgentTab> = [
    "workbench",
    "work",
    "graph",
    "workflows",
    "chat",
    "performance",
    "connections",
    "knowledge",
    "setup",
]

/** The agent types that have the Performance tab: the AI Marketing (content) agent reads its weekly report there. */
const PERFORMANCE_MODULES: ReadonlySet<ModuleKey> = new Set<ModuleKey>(["content"])
const SETUP_TAB: AgentTab = "setup"
/** The tab the landing path of an instance shows while it decides where to go. */
const LANDING_TAB: AgentTab = "workbench"

/** The view `useInstanceTabs` returns. */
export interface InstanceTabsView {
    tabs: AgentTab[]
    selected: AgentTab
    open: (id: string) => void
    hrefOf: (tab: AgentTab) => string
}

/** The tabs of one agent instance (Setup only for owners and managers, Performance only for the AI Marketing agent): the one the path names, and the way to open another. */
export const useInstanceTabs = (module: ModuleKey, installationId: string): InstanceTabsView => {
    const member = useMember()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const pathname = navigation.usePathname()
    const tabs = ALL_TABS.filter(
        (tab) => (tab !== SETUP_TAB || isManager(member)) && (tab !== "performance" || PERFORMANCE_MODULES.has(module)),
    )
    const selected = tabs.find((tab) => pathname.endsWith(`/${tab}`) || pathname.includes(`/${tab}/`)) ?? LANDING_TAB
    const open = (id: string) => {
        const tab = ALL_TABS.find((entry) => entry === id)
        if (tab !== undefined) router.push(workspaceHref(workspaceId, agentHref(module, installationId, tab)))
    }
    const hrefOf = (tab: AgentTab) => workspaceHref(workspaceId, agentHref(module, installationId, tab))
    return { tabs, selected, open, hrefOf }
}
