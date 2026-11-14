import type { ReactNode } from "react"
import { TARGET_CLASS } from "./classNames"

/** The control the guide can point at. */
interface GuideTargetProps {
    /** The `data-guide-id` the guide's index names, e.g. `agents.create`. */
    readonly id: string
    readonly children: ReactNode
}

/**
 * Marks a control as a place the NIVO guide can scroll to and ring. The marker draws nothing and has no box: the guide rings its
 * first child. Wrap the control only; never a whole region.
 */
export const GuideTarget = (props: GuideTargetProps) => (
    <span data-guide-id={props.id} className={TARGET_CLASS}>
        {props.children}
    </span>
)
