"use client"

import { useDriveChooserView } from "@/hooks/drive"
import { DriveConnectionChooseBase } from "./component"

/** The connected choose step: read a Drive folder, tick the files NIVO can read, add them to Second Brain as sources. */
export const DriveConnectionChoose = () => {
    const { props, on } = useDriveChooserView()
    return <DriveConnectionChooseBase props={props} on={on} />
}
