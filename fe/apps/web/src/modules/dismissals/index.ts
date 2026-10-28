import { LocalStorage, StorageId } from "@/modules/storage"

const listeners = new Set<() => void>()

const dismissedRecord = (): Record<string, boolean> =>
    LocalStorage.get<Record<string, boolean>>(StorageId.Dismissed) ?? {}

/** Whether the reader closed the notice stored under `key`; false when the browser keeps no storage. */
export const readDismissed = (key: string): boolean => dismissedRecord()[key] === true

/** Remembers, best effort, that the reader closed the notice and tells every subscriber; returns whether it was kept. */
export const writeDismissed = (key: string): boolean => {
    const kept = LocalStorage.set(StorageId.Dismissed, { ...dismissedRecord(), [key]: true })
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
