import type { ReactNode } from "react"

/** What the session gate draws: the label announced while it waits, and the subtree it lets through once ready. */
interface ConsoleSessionGateBaseProps {
    readonly isReady: boolean
    readonly loadingLabel: string
    readonly content: ReactNode
}

/** Draws the console subtree once the session is usable, and an announced busy region until then. */
export const ConsoleSessionGateBase = (props: ConsoleSessionGateBaseProps) =>
    props.isReady ? props.content : <div role="status" aria-busy="true" aria-label={props.loadingLabel} />
