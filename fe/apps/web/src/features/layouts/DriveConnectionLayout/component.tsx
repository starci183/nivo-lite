import type { ReactNode } from "react"
import { DriveConnectionHead } from "@/components/blocks/DriveConnectionHead"

/** What the Drive route hands the layout: the routed page. */
export interface DriveConnectionLayoutBaseProps {
    readonly children: ReactNode
}

/** Draws the one Page of the Google Drive route: the connected band with its tabs, over the routed page, which draws the body of the open tab. */
export const DriveConnectionLayoutBase = (props: DriveConnectionLayoutBaseProps) => (
    <DriveConnectionHead>{props.children}</DriveConnectionHead>
)
