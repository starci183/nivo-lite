"use client"

import { useTranslations } from "next-intl"
import { BRAIN_PANEL_PREFIX, useBrainStats } from "@/hooks/brain"
import { navigation } from "@/modules/i18n"
import { BRAIN_TABS, brainTabHref } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"
import { BrainTabsBase } from "./component"

/** What the page hands the tabs. */
interface BrainTabsProps {
    readonly selected: BrainTab
}

/** The connected tabs: the selected one lives in the address, and the tabs that hold a count carry it once it is known (a count of zero is no label). */
export const BrainTabs = (props: BrainTabsProps) => {
    const t = useTranslations("secondBrain")
    const router = navigation.useRouter()
    const { figures, canDecide } = useBrainStats()
    const labelOf = (tab: BrainTab): string => {
        if (tab === "review" && figures.waiting > 0) return t("tab_review_count", { n: figures.waiting })
        return tab === "gaps" && figures.gaps > 0 ? t("tab_gaps_count", { n: figures.gaps }) : t(`tab_${tab}`)
    }
    const shown = BRAIN_TABS.filter((tab) => tab !== "gaps" || canDecide || props.selected === "gaps")
    return (
        <BrainTabsBase
            props={{
                label: t("tabsLabel"),
                selected: props.selected,
                panelIdPrefix: BRAIN_PANEL_PREFIX,
                tabs: shown.map((tab) => ({ id: tab, label: labelOf(tab) })),
            }}
            on={{
                select: (id) => {
                    const next = BRAIN_TABS.find((tab) => tab === id)
                    if (next !== undefined) router.replace(brainTabHref(next))
                },
            }}
        />
    )
}
