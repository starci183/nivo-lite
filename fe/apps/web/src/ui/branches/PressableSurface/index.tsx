import type { ReactNode } from "react"
import { PRESSABLE_SURFACE_CLASS_NAME } from "./classNames"

/** Hover presentation for a pressable surface. */
export type PressableSurfaceHover = "label" | "surface"
/** Props for an accessible press target containing ordinary React content. */
export type PressableSurfaceProps = { readonly label: string; readonly children?: ReactNode; readonly render?: ReactNode; readonly press?: () => void; readonly isDisabled?: boolean; readonly hover?: PressableSurfaceHover }

/** Render one keyboard-accessible press target. */
export const PressableSurface = (props: PressableSurfaceProps) => (
    <button className={PRESSABLE_SURFACE_CLASS_NAME} type="button" aria-label={props.label} onClick={props.press} disabled={props.isDisabled}>
        {props.children ?? props.render}
    </button>
)
