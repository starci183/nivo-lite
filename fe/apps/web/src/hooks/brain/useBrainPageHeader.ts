import { useTranslations } from "next-intl"
import { BRAIN_PANEL_PREFIX } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { BRAIN_STRIP_TABS, brainStripTabOf, brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainStripTab, BrainTab } from "@/modules/routes"
import type { BrainPageHeading, BrainPageHeaderView } from "@/modules/types"
import { useBrain } from "./useBrain"
import { useBrainTodoCount } from "./useBrainTodoCount"
import { useBrainPageActions } from "./useBrainPageActions"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The view `useBrainPageHeader` returns. */
export interface BrainPageHeaderViewShape {
    props: BrainPageHeaderView
    on: {
        selectTab: (id: string) => void
        reviewAll: () => void
        setPart: (id: string) => void
    }
}

/**
 * The Second Brain's page header with its one tab strip: the selected tab lives in the address (the map lights the dossiers, the customer questions the public documents, the customer chat the agents' view). The queue of what needs doing carries
 * its count once there is something in it (a count of zero is no label); it is the number the rail shows too. The customer questions
 * nobody answered carry theirs on the public tab.
 */
export const useBrainPageHeader = (selected: BrainTab, heading: BrainPageHeading): BrainPageHeaderViewShape => {
    const t = useTranslations("secondBrain")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const todo = useBrainTodoCount()
    const asks = useBrain().brain?.gapsOpen ?? 0
    const actions = useBrainPageActions(selected)
    const labelOf = (tab: BrainStripTab): string => {
        if (tab === "todo" && todo > 0) return t("tab_todo_count", { n: todo })
        if (tab === "publicDocs" && asks > 0) return t("tab_publicDocs_count", { n: asks })
        return t(`tab_${tab}`)
    }
    const props: BrainPageHeaderView = {
        heading,
        actions: actions.props,
        tabs: {
            label: t("tabsLabel"),
            selectedKey: brainStripTabOf(selected),
            panelPrefix: BRAIN_PANEL_PREFIX,
            items: BRAIN_STRIP_TABS.map((tab) => ({ id: tab, label: labelOf(tab) })),
        },
    }
    return {
        props,
        on: {
            ...actions.on,
            selectTab: (id: string) => {
                const next = BRAIN_STRIP_TABS.find((tab) => tab === id)
                if (next !== undefined) router.replace(workspaceHref(workspaceId, brainTabHref(next)))
            },
        },
    }
}
