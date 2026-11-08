import type { ReactNode } from "react"
import { SurfaceCard, type SurfaceCardProps } from "@starci/grammar/common"

/** The plain card a slot's notice (loading, empty, error) is drawn in: the frame a block gives its SlotView. */
type FrameCardProps = Extract<SurfaceCardProps, { readonly kind?: "body" }>

/** The face of that card: its name, heading level and header zones; its content is the notice. */
type FrameCardFace = Pick<FrameCardProps, "label" | "ariaLabel" | "headingLevel" | "headers">

/** The frame of a slot's notice: the notice inside a plain card with the given face. */
export const surfaceFrame =
    (card: FrameCardFace) =>
    (notice: ReactNode): ReactNode => <SurfaceCard {...card}>{notice}</SurfaceCard>
