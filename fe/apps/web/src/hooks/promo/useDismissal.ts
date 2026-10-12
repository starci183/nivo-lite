import { useSyncExternalStore } from "react"
import { readDismissed, subscribeDismissed, writeDismissed } from "@/modules/dismissals"

/** What a dismissible notice needs: whether to hide it and the command that closes it. */
type Dismissal = {
    readonly isHidden: boolean
    readonly dismiss: () => void
}

/** Remembers that the reader closed a notice; on the server and before hydration it stays hidden, so it never flashes. */
export const useDismissal = (key: string, isActive: boolean): Dismissal => {
    const state = useSyncExternalStore(
        subscribeDismissed,
        () => (readDismissed(key) ? "hidden" : "shown"),
        () => "unknown",
    )
    return {
        isHidden: isActive && state !== "shown",
        dismiss: () => {
            writeDismissed(key)
        },
    }
}
