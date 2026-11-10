"use client"

import type { KeyboardEvent } from "react"

const PRESS = '[data-grammar-row-press="true"]'
const FIELD = "input"
const SHEET = '[role="dialog"]'

/**
 * Arrow keys through the results: Down from the field goes to the first result, Down and Up step between results, Up from the first
 * returns to the field. The results are Grammar rows whose title is the one focusable press target, so Enter or Space on a focused
 * result opens it with the platform's own behaviour and the focus ring is Grammar's. Put `onKeyDown` on the result list and on the
 * field's band; the drawer sheet around them is the scope.
 */
export const onGuideKeys = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    const sheet = event.currentTarget.closest<HTMLElement>(SHEET)
    if (sheet === null) return
    const rows = Array.from(sheet.querySelectorAll<HTMLElement>(PRESS))
    const at = rows.findIndex((row) => row === document.activeElement)
    if (at === -1 && event.key === "ArrowUp") return
    event.preventDefault()
    const next = event.key === "ArrowDown" ? at + 1 : at - 1
    if (next < 0) sheet.querySelector<HTMLElement>(FIELD)?.focus()
    else rows[Math.min(next, rows.length - 1)]?.focus()
}
