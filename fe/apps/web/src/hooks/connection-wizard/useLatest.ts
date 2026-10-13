import { useEffect, useRef } from "react"
import type { RefObject } from "react"

/** Keeps the newest value of a handed-in function reachable from an effect without making the effect depend on it. */
export const useLatest = <T>(value: T): RefObject<T> => {
    const latest = useRef(value)
    useEffect(() => {
        latest.current = value
    })
    return latest
}
