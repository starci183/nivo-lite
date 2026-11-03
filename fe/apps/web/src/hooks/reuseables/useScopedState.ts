"use client"

import { useState } from "react"
import type { Dispatch, SetStateAction } from "react"

/** A value with the activation and scope that wrote it: a different activation or scope no longer owns it. */
interface ScopedValue<T> {
    readonly isActive: boolean
    readonly scope: string
    readonly value: T
}

/** Whether a state write is an updater function rather than a value. */
const isUpdater = <T>(next: SetStateAction<T>): next is (previous: T) => T => typeof next === "function"

/**
 * Local state that starts over from `initial` whenever the activation or the scope changes, derived while rendering so no effect
 * sets it and no render shows the previous owner's value. A write made in the current owner replaces the value as usual.
 */
export const useScopedState = <T>(initial: T, isActive: boolean, scope: string): [T, Dispatch<SetStateAction<T>>] => {
    const [stored, setStored] = useState<ScopedValue<T>>({ isActive, scope, value: initial })
    const isOwned = stored.isActive === isActive && stored.scope === scope
    const set: Dispatch<SetStateAction<T>> = (next) =>
        setStored((current) => {
            const isCurrentOwner = current.isActive === isActive && current.scope === scope
            const base = isCurrentOwner ? current.value : initial
            return { isActive, scope, value: isUpdater(next) ? next(base) : next }
        })
    return [isOwned ? stored.value : initial, set]
}
