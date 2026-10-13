import { useTranslations } from "next-intl"
import { useContentRibbon } from "./useContentRibbon"
import { useContentWorkbench } from "./useContentWorkbench"

/** The content part of a workbench header: the figures of the ribbon and the tabs, with the number of posts waiting. */
export const useContentHeaderParts = () => {
    const t = useTranslations("content")
    const workbench = useContentWorkbench()
    const data = workbench.data
    const figures = useContentRibbon(data?.figures)
    const waiting = data ? data.items.filter((item) => item.status === "waiting_approval").length : 0
    return {
        figures,
        figuresFailed: Boolean(workbench.error) || (data !== undefined && data.figures === null),
        isLoading: data === undefined && !workbench.error,
        tabs: [
            { id: "calendar", label: t("tabCalendar") },
            { id: "list", label: t("tabList") },
            { id: "queue", label: `${t("tabQueue")}${waiting > 0 ? ` (${waiting})` : ""}` },
            { id: "balance", label: t("tabBalance") },
            { id: "settings", label: t("tabSettings") },
        ],
    }
}
