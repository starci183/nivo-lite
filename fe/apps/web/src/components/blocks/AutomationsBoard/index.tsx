"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useAutomationsBoard } from "@/hooks/automations"

import { useSlotLabels } from "@/hooks/slot"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { usePaneCopy } from "@/hooks/paneFrame"
import { AutomationsBoardBase } from "./component"

/** The query key of the search text: the address is the one place the screen keeps it. */
const SEARCH_KEY = "q"

/** Replaces the search key of the address without leaving the page. */
const writeSearch = (value: string): void => {
    const query = new URLSearchParams(window.location.search)
    if (value === "") query.delete(SEARCH_KEY)
    else query.set(SEARCH_KEY, value)
    const rest = query.toString()
    window.history.replaceState(null, "", rest === "" ? window.location.pathname : `?${rest}`)
}

/** What the pages tell the board. */
interface AutomationsBoardProps {
    /** "page": filters and a grid with the detail beside it. "module": one module's cards as a compact list, detail below. */
    readonly layout: "page" | "module"
    readonly moduleKey?: string
    /** The card to open when the board appears; none stays closed. */
    readonly focus?: string
}

/**
 * The connected board: cards, switches, filters, the detail and the hidden list. Reads the gallery from the back end
 * through SWR and writes every change through the `updateAutomationPipeline` mutation; refusals are toasted.
 */
export const AutomationsBoard = (props: AutomationsBoardProps) => {
    const t = useTranslations("automations")
    const locale = useLocale() === "en" ? "en" : "vi"
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const pane = usePaneCopy()
    const query = useSearchParams().get(SEARCH_KEY) ?? ""
    const board = useAutomationsBoard({
        layout: props.layout,
        t,
        locale,
        when: (iso) => format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" }),
        ...(props.moduleKey === undefined ? {} : { moduleKey: props.moduleKey }),
        ...(props.focus === undefined ? {} : { focus: props.focus }),
    })
    return (
        <AutomationsBoardBase
            props={{
                slot: board.slot,
                layout: props.layout,
                labels: {
                    slot: { ...slotLabels(t("emptyAll")), forbidden: t("forbiddenTitle"), error: t("loadFailed") },
                    forbiddenDescription: t("forbiddenBody"),
                    backLabel: t("forbiddenBack"),
                    backHref: CONSOLE_ROUTES.chat,
                    collection: t("title"),
                    loading: t("loading"),
                    status: t("statusOff"),
                    select: t("selectHint"),
                },
                panes: {
                    query,
                    copy: {
                        grid: t("title"),
                        list: t("filtersLabel"),
                        search: t("searchLabel"),
                        searchPlaceholder: t("searchPlaceholder"),
                        clearSearch: pane.clearSearch,
                        back: pane.backToList,
                        moreActions: pane.moreActions,
                        pickTitle: t("pickTitle"),
                        pickBody: t("pickBody"),
                        emptyFiltered: t("emptyFiltered"),
                    },
                },
            }}
            on={{ ...board.on, retry: board.retry, search: writeSearch }}
        />
    )
}
