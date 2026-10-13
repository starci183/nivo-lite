"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useAutomationsBoard } from "@/hooks/automations"
import type { AutomationsBoardState } from "@/hooks/automations"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { ModuleScope } from "@/modules/types"
import { AutomationsBoardBase } from "./component"
import type { AutomationsBoardNotice } from "./component"

/** What the pages tell the board. */
interface AutomationsBoardProps {
    /** "page": filters and a grid with the detail beside it. "module": one module's cards as a compact list, detail below. */
    readonly layout: "page" | "module"
    readonly moduleKey?: ModuleScope
    /** The card to open when the board appears; none stays closed. */
    readonly focus?: string
}

/** Why the board shows a notice instead of the cards, if it does: the member may not manage automations, or the read failed. */
const noticeOf = (
    board: AutomationsBoardState,
    layout: "page" | "module",
    t: (key: string) => string,
): AutomationsBoardNotice | undefined => {
    if (board.isForbidden)
        return {
            kind: "forbidden",
            title: t("forbiddenTitle"),
            body: t("forbiddenBody"),
            backLabel: t("forbiddenBack"),
            backHref: CONSOLE_ROUTES.chat,
            isPage: layout === "page",
        }
    if (board.view === undefined && board.error !== undefined) return { kind: "failed", title: t("loadFailed") }
    return undefined
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
                slot: board.view === undefined ? loadingSlot() : { items: board.view },
                layout: props.layout,
                notice: noticeOf(board, props.layout, t),
                labels: {
                    slot: slotLabels(t("emptyAll")),
                    loading: t("loading"),
                    status: t("statusOff"),
                    select: t("selectHint"),
                },
            }}
            on={board.on}
        />
    )
}
