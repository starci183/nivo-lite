import type { ReactNode } from "react"

/** What the layout hands its drawing half: the side effects it mounts. */
export interface SideEffectsLayoutBaseProps {
    readonly children: ReactNode
}

/** Draws nothing of its own: mounts the app-wide side effects of the signed-in session it is handed. */
export const SideEffectsLayoutBase = (props: SideEffectsLayoutBaseProps) => <>{props.children}</>
