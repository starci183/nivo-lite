import { useState } from "react"

/** The open/closed state of one drawer: `state` is null while it is closed. */
export interface DrawerControl<State> {
    readonly state: State | null
    /** Opens the drawer on the given state. */
    readonly open: (next: State) => void
    /** Closes the drawer. */
    readonly close: () => void
    /** Closes the drawer and answers no notice; the shape a finished command hands back. */
    readonly done: () => undefined
    /** Changes the open drawer's state; a closed drawer stays closed. */
    readonly change: (apply: (current: State) => State) => void
}

/** Holds the state of one drawer with the four moves every drawer makes. */
export const useDrawer = <State>(): DrawerControl<State> => {
    const [state, setState] = useState<State | null>(null)
    const close = () => setState(null)
    return {
        state,
        open: setState,
        close,
        done: () => {
            close()
            return undefined
        },
        change: (apply) => setState((current) => (current === null ? null : apply(current))),
    }
}
