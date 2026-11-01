"use client"

import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryDriveGrantSwr } from "@/hooks/swr"
import { driveStandingOf } from "./drive.shared"
import type { DriveGrantStanding } from "./drive.shared"

/** What one read of the Google Drive grant answers. */
interface DrivePageData {
    readonly standing: DriveGrantStanding
    /** The Google account that gave the grant, blank when none. */
    readonly email: string
}

/** The Google Drive grant of the workspace (one per workspace, so the page has no id): where it stands and which account gave it. Nothing is read while `enabled` is false. */
export const useDrivePage = (enabled = true) => {
    const read = useQueryDriveGrantSwr(enabled)
    return {
        slot: mapSlot(slotOfSwr(read), (grant): DrivePageData => ({
            standing: driveStandingOf(grant.state),
            email: grant.email,
        })),
        reload: () => void read.mutate(),
        mutate: read.mutate,
    }
}
