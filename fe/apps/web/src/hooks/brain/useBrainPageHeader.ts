import { useTranslations } from "next-intl"
import type { PageHeaderContent } from "@starci/grammar/common"
import { BRAIN_PANEL_PREFIX } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { BRAIN_TABS, brainTabHref } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"
import { useBrainTodoCount } from "./useBrainTodoCount"

/**
 * The Second Brain's page header with its tabs: the selected tab lives in the address. The queue of what needs doing carries
 * its count once there is something in it (a count of zero is no label); it is the number the rail shows too.
 */
export const useBrainPageHeader = (selected: BrainTab, header: PageHeaderContent): PageHeaderContent => {
    const t = useTranslations("secondBrain")
    const router = navigation.useRouter()
    const todo = useBrainTodoCount()
    const labelOf = (tab: BrainTab): string =>
        tab === "todo" && todo > 0 ? t("tab_todo_count", { n: todo }) : t(`tab_${tab}`)
    return {
        ...header,
        tabs: {
            label: t("tabsLabel"),
            selectedKey: selected,
            labelVisibility: "always",
            panelId: (key) => `${BRAIN_PANEL_PREFIX}${key}`,
            items: BRAIN_TABS.map((tab) => ({ id: tab, label: labelOf(tab) })),
            onSelect: (id) => {
                const next = BRAIN_TABS.find((tab) => tab === id)
                if (next !== undefined) router.replace(brainTabHref(next))
            },
        },
    }
}
