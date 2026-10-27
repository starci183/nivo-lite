import type { ReactNode } from "react"

/** What the gate draws: the console frame once the session is read, else the waiting surface. */
export interface ConsoleSessionGateBaseProps {
    /** The console frame behind the gate. */
    readonly shape: { readonly frame: ReactNode }
    readonly props: {
        /** Whether the session is read and the console frame may draw. */
        readonly isReady: boolean
        /** The words a screen reader hears while the console frame waits for the session. */
        readonly waitingLabel: string
    }
}

/** Draws the console frame once the session is read; until then an empty, busy region. */
export const ConsoleSessionGateBase = (props: ConsoleSessionGateBaseProps) =>
    props.props.isReady ? (
        <>{props.shape.frame}</>
    ) : (
        <div role="status" aria-busy="true" aria-label={props.props.waitingLabel} />
    )
