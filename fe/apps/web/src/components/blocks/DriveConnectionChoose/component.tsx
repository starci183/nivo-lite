import type { ComponentProps } from "react"
import { DriveFileChooser } from "@/components/composites/DriveFileChooser"

/** Copy, state and commands of the choose step. */
export type DriveConnectionChooseBaseProps = ComponentProps<typeof DriveFileChooser>

/** Draws the body of the choose step: the folder link, the files read from it as a ticked list, who may use them, and the add command. */
export const DriveConnectionChooseBase = (props: DriveConnectionChooseBaseProps) => (
    <DriveFileChooser props={props.props} on={props.on} />
)
