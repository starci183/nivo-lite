import type { ReactNode } from "react"

/** Props for a bounded form surface. */
export type SurfaceFormCardProps = { readonly ariaLabel: string; readonly children?: ReactNode; readonly render?: ReactNode }

/** Render a form body inside one accessible bounded surface. */
export const SurfaceFormCard = (props: SurfaceFormCardProps) => (
    <section aria-label={props.ariaLabel}>
        {props.children ?? props.render}
    </section>
)