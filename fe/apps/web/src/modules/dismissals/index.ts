const listeners = new Set<() => void>()

/** Whether the reader closed the notice stored under `key`; false when the browser keeps no storage. */
export const readDismissed = (key: string): boolean => {
    try {
        return window.localStorage.getItem(key) === "1"
    } catch {
        return false
    }
}

/** Remembers, best effort, that the reader closed the notice and tells every subscriber; returns whether it was kept. */
export const writeDismissed = (key: string): boolean => {
    let kept = false
    try {
        window.localStorage.setItem(key, "1")
        kept = true
    } catch {
        kept = false
    }
    listeners.forEach((listener) => listener())
    return kept
}

/** Subscribes to dismissals made in this tab or another; returns the unsubscribe. */
export const subscribeDismissed = (listener: () => void): (() => void) => {
    listeners.add(listener)
    window.addEventListener("storage", listener)
    return () => {
        listeners.delete(listener)
        window.removeEventListener("storage", listener)
    }
}
