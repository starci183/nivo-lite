import type { ReactNode } from "react"
import { SurfaceCard } from "@starci/grammar/common"
import type { SurfaceCardProps } from "@starci/grammar/common"

/** The plain card a slot's notice (loading, empty, error) is drawn in: the frame a block gives its SlotView. */
type FrameCardProps = Extract<SurfaceCardProps, { readonly kind?: "body" }>

/** The frame of a slot's notice: the notice inside a plain card with the given face. */
export const surfaceFrame =
    (card: Omit<FrameCardProps, "children">) =>
    (notice: ReactNode): ReactNode => <SurfaceCard {...(card as FrameCardProps)}>{notice}</SurfaceCard>
