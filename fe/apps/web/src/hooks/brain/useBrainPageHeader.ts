import { useTranslations } from "next-intl"
import { BRAIN_PANEL_PREFIX, brainPartOf } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { BRAIN_PART_TABS, brainTabHref } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"
import type { BrainPageHeading, BrainPageHeaderView } from "@/modules/types"
import { useBrain } from "./useBrain"
import { useBrainTodoCount } from "./useBrainTodoCount"
import { useBrainPageActions } from "./useBrainPageActions"

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
 * The Second Brain's page header with the tabs of the part that is open: the selected tab lives in the address. The queue of what needs doing carries
 * its count once there is something in it (a count of zero is no label); it is the number the rail shows too. The customer questions
 * nobody answered carry theirs on the public part.
 */
export const useBrainPageHeader = (selected: BrainTab, heading: BrainPageHeading): BrainPageHeaderViewShape => {
    const t = useTranslations("secondBrain")
    const router = navigation.useRouter()
    const todo = useBrainTodoCount()
    const asks = useBrain().brain?.gapsOpen ?? 0
    const part = brainPartOf(selected)
    const actions = useBrainPageActions(selected)
    const labelOf = (tab: BrainTab): string => {
        if (tab === "todo" && todo > 0) return t("tab_todo_count", { n: todo })
        if (tab === "publicAsks" && asks > 0) return t("tab_publicAsks_count", { n: asks })
        return t(`tab_${tab}`)
    }
    const props: BrainPageHeaderView = {
        heading,
        actions: actions.props,
        tabs: {
            label: t("tabsLabel"),
            selectedKey: selected,
            panelPrefix: BRAIN_PANEL_PREFIX,
            items: BRAIN_PART_TABS[part].map((tab) => ({ id: tab, label: labelOf(tab) })),
        },
    }
    return {
        props,
        on: {
            ...actions.on,
            selectTab: (id: string) => {
                const next = BRAIN_PART_TABS[part].find((tab) => tab === id)
                if (next !== undefined) router.replace(brainTabHref(next))
            },
        },
    }
}
