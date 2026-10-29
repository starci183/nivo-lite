"use client"

import { useEffect, useRef } from "react"

/**
 * Keeps the last shown value while its source is gone, so an overlay can play its exit animation on what it drew: `value` is the live
 * one, else the one kept; `isOpen` says whether the source is still there.
 */
export const useRetainedWhileClosing = <T>(value: T | null): { readonly value: T | null; readonly isOpen: boolean } => {
    const kept = useRef<T | null>(null)
    useEffect(() => {
        if (value !== null) kept.current = value
    }, [value])
    return { value: value ?? kept.current, isOpen: value !== null }
}
