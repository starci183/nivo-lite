"use client"

import { useState } from "react"
import type { usePanePhone } from "@/hooks/paneFrame"
import type { BrainFilterView } from "@/modules/types"

/** The rows the tabs keep, the one open and the commands that change them. */
interface PanePicker<Row extends { readonly id: string; readonly filter: string }> {
    readonly filter: string
    readonly shown: ReadonlyArray<Row>
    readonly selected: Row | null
    readonly setFilter: (id: string) => void
    readonly select: (id: string) => void
}

/**
 * The choice state of a list beside an opened item: the tab picked (falling back to "all" when it vanished), the rows it keeps of
 * the rows the search kept, and the row open (the first, unless a phone is showing the list).
 */
export const usePanePicker = <Row extends { readonly id: string; readonly filter: string }>(
    tabs: ReadonlyArray<BrainFilterView>,
    rows: ReadonlyArray<Row>,
    phone: ReturnType<typeof usePanePhone>,
): PanePicker<Row> => {
    const [picked, setPicked] = useState("all")
    const [chosen, setChosen] = useState<string | null>(null)
    const filter = tabs.some((one) => one.id === picked) ? picked : "all"
    const shown = rows.filter((row) => filter === "all" || row.filter === filter)
    return {
        filter,
        shown,
        selected: shown.find((row) => row.id === chosen) ?? (phone.phone === "main" ? null : (shown[0] ?? null)),
        setFilter: (id) => setPicked(tabs.find((one) => one.id === id)?.id ?? filter),
        select: (id) => {
            setChosen(id)
            phone.showMain()
        },
    }
}
