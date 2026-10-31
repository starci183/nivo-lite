import { useTranslations } from "next-intl"
import type { PageHeaderContent } from "@starci/grammar/common"
import { BRAIN_PANEL_PREFIX } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { BRAIN_TABS, brainTabHref } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"
import { useBrainStats } from "./useBrainStats"

/**
 * The Second Brain's page header with its tabs: the selected tab lives in the address, and the tabs that hold a count carry
 * it once it is known (a count of zero is no label). The questions tab shows only to those who may answer, or while open.
 */
export const useBrainPageHeader = (selected: BrainTab, header: PageHeaderContent): PageHeaderContent => {
    const t = useTranslations("secondBrain")
    const router = navigation.useRouter()
    const { figures, canDecide } = useBrainStats()
    const labelOf = (tab: BrainTab): string => {
        if (tab === "review" && figures.waiting > 0) return t("tab_review_count", { n: figures.waiting })
        return tab === "gaps" && figures.gaps > 0 ? t("tab_gaps_count", { n: figures.gaps }) : t(`tab_${tab}`)
    }
    const shown = BRAIN_TABS.filter((tab) => tab !== "gaps" || canDecide || selected === "gaps")
    return {
        ...header,
        tabs: {
            label: t("tabsLabel"),
            selectedKey: selected,
            labelVisibility: "always",
            panelId: (key) => `${BRAIN_PANEL_PREFIX}${key}`,
            items: shown.map((tab) => ({ id: tab, label: labelOf(tab) })),
            onSelect: (id) => {
                const next = BRAIN_TABS.find((tab) => tab === id)
                if (next !== undefined) router.replace(brainTabHref(next))
            },
        },
    }
}
