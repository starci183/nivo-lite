"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useDriveHead } from "@/hooks/drive"
import { DriveConnectionNoticesBase } from "./component"

/** The connected notices of the Google Drive page: the grant was revoked, Google sent the owner back with a reason, a refused command. */
export const DriveConnectionNotices = () => {
    const { notices } = useDriveHead()
    const refusal = useConnectionRefusal()
    return <DriveConnectionNoticesBase props={{ notices, ...(refusal === undefined ? {} : { refusal }) }} />
}
