import type { ReactElement, ReactNode } from "react"
import { DriveConnectionLayoutBase } from "./component"

/** What the route hands the layout: the routed page. */
interface DriveConnectionLayoutProps {
    readonly children: ReactNode
}

/** The layout of the Google Drive route: one band with the status, the action and the tabs for every page under it. */
export const DriveConnectionLayout = (props: DriveConnectionLayoutProps): ReactElement => (
    <DriveConnectionLayoutBase>{props.children}</DriveConnectionLayoutBase>
)
