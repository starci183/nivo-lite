"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { usePaneCopy } from "@/hooks/paneFrame"
import type { WorkbenchAsideActions, WorkbenchAsideView } from "@/modules/types"
import { workbenchGridOf, type WorkbenchPane } from "./workbench.shared"

/** The query key of the side pane: `waiting` opens the decisions as the one pane a phone shows, `closed` hides the side pane. */
const PANE_QUERY_KEY = "pane"

const paneOf = (value: string | null): WorkbenchPane => {
    if (value === "waiting") return "waiting"
    return value === "closed" ? "closed" : "default"
}

/** Replaces the pane key of the address without leaving the page, like the tab and the explanation do. */
const writePane = (next: WorkbenchPane): void => {
    const query = new URLSearchParams(window.location.search)
    if (next === "default") query.delete(PANE_QUERY_KEY)
    else query.set(PANE_QUERY_KEY, next)
    const rest = query.toString()
    window.history.replaceState(null, "", rest === "" ? window.location.pathname : `?${rest}`)
}

type UseWorkbenchAsideResult = {
    readonly view: WorkbenchAsideView
    readonly on: WorkbenchAsideActions
}

/**
 * The side pane of a workbench: its arrangement and the words of its heads, and the commands that open and close it. `hasWhy`
 * is true while a decision is explained (`?why=`), which the side pane then holds.
 */
export const useWorkbenchAside = (hasWhy: boolean): UseWorkbenchAsideResult => {
    const t = useTranslations("workbench")
    const pane = usePaneCopy()
    const value = useSearchParams().get(PANE_QUERY_KEY)
    const chosen = paneOf(value)
    return {
        view: {
            grid: workbenchGridOf({ pane: chosen, hasWhy }),
            isHidden: chosen === "closed" && !hasWhy,
            copy: { grid: t("gridLabel"), close: pane.closeAside, back: t("backToDesk") },
        },
        on: {
            open: (): void => writePane("waiting"),
            close: (): void => writePane("closed"),
        },
    }
}
