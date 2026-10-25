import { LocalStorage } from "./storage"
import { StorageId } from "./ids"

const listeners = new Set<() => void>()

/** Whether this person collapsed the console rail; expanded without a stored choice. */
export const railCollapsedOf = (userId: string): boolean =>
    LocalStorage.get<Record<string, boolean>>(StorageId.RailCollapsed)?.[userId] === true

/** Remembers this person's rail choice and tells every reader. A browser that refuses storage keeps the old answer. */
export const rememberRailCollapsed = (userId: string, collapsed: boolean): void => {
    const all = LocalStorage.get<Record<string, boolean>>(StorageId.RailCollapsed) ?? {}
    LocalStorage.set(StorageId.RailCollapsed, { ...all, [userId]: collapsed })
    listeners.forEach((listener) => listener())
}

/** Calls `onChange` after every remembered choice; answers the function that stops listening. */
export const subscribeRailCollapsed = (onChange: () => void): (() => void) => {
    listeners.add(onChange)
    return () => listeners.delete(onChange)
}
