"use client"

import { useEffect, useRef } from "react"

/** The evidence field the editor of a checklist item shows. */
const editFieldOf = (gateKey: string): HTMLElement | null =>
    document.querySelector<HTMLElement>(`textarea[name="gate-${CSS.escape(gateKey)}"]`)

/** The first command of a checklist row, its Edit button (the row's copy and commands come before its body). */
const editButtonOf = (row: Element | null): HTMLElement | null => row?.querySelector<HTMLElement>("button") ?? null

/**
 * Keeps focus with the person while a checklist item opens and closes its editor: opening moves it to the evidence field (the
 * Edit button that held it is gone), closing returns it to the Edit button of the same row.
 */
export const useEditFocus = (editing: string): void => {
    const row = useRef<Element | null>(null)
    useEffect(() => {
        if (editing !== "") {
            const field = editFieldOf(editing)
            row.current = field?.closest("li") ?? null
            field?.focus()
            return
        }
        editButtonOf(row.current)?.focus()
        row.current = null
    }, [editing])
}
