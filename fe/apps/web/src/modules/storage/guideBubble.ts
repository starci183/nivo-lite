import { LocalStorage } from "./storage"
import { StorageId } from "./ids"

const listeners = new Set<() => void>()

/** Whether this browser shows the floating assistant button; hidden without a stored choice. */
export const guideBubbleShown = (): boolean => LocalStorage.get<boolean>(StorageId.GuideBubbleShown) === true

/** Remembers the choice in this browser and tells every reader. A browser that refuses storage keeps the old answer. */
export const rememberGuideBubbleShown = (shown: boolean): void => {
    LocalStorage.set(StorageId.GuideBubbleShown, shown)
    listeners.forEach((listener) => listener())
}

/** Calls `onChange` after every remembered choice; answers the function that stops listening. */
export const subscribeGuideBubbleShown = (onChange: () => void): (() => void) => {
    listeners.add(onChange)
    return () => listeners.delete(onChange)
}
