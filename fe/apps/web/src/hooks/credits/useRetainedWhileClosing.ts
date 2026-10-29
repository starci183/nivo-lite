"use client"

import { useState } from "react"

/** The last live value with the serialized form it was compared by. */
interface Kept<T> {
    readonly key: string
    readonly value: T
}

/**
 * Keeps the last shown value while its source is gone, so an overlay can play its exit animation on what it drew: `value` is the live
 * one, else the one kept; `isOpen` says whether the source is still there. The value must be plain data (it is compared by its
 * serialized form, so a freshly built object with the same content does not retain again).
 */
export const useRetainedWhileClosing = <T>(value: T | null): { readonly value: T | null; readonly isOpen: boolean } => {
    const [kept, setKept] = useState<Kept<T> | null>(null)
    if (value !== null) {
        const key = JSON.stringify(value)
        if (kept?.key !== key) setKept({ key, value })
    }
    return { value: value ?? kept?.value ?? null, isOpen: value !== null }
}
