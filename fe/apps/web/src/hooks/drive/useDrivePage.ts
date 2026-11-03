"use client"

import { mapSlot, slotOfSwr } from "@/hooks/slot"
import type { SlotRead } from "@/hooks/slot"
import { useQueryDriveGrantSwr } from "@/hooks/swr"
import { driveStandingOf } from "./drive.shared"
import type { DriveGrantStanding } from "./drive.shared"
import type { DataSlot } from "@/modules/types"
import type { KeyedMutator } from "swr"

/** What one read of the Google Drive grant answers. */
interface DrivePageData {
    readonly standing: DriveGrantStanding
    /** The Google account that gave the grant, blank when none. */
    readonly email: string
}

/** The view `useDrivePage` returns. */
export interface DrivePageView {
    reads: readonly SlotRead<unknown>[]
    slot: DataSlot<DrivePageData>
    reload: () => undefined
    mutate: KeyedMutator<{
        state: string
        email: string
    }>
}

/** The Google Drive grant of the workspace (one per workspace, so the page has no id): where it stands and which account gave it. Nothing is read while `enabled` is false. */
export const useDrivePage = (enabled = true): DrivePageView => {
    const read = useQueryDriveGrantSwr(enabled)
    const reads: ReadonlyArray<SlotRead<unknown>> = enabled ? [read] : []
    return {
        reads,
        slot: mapSlot(slotOfSwr(read), (grant): DrivePageData => ({
            standing: driveStandingOf(grant.state),
            email: grant.email,
        })),
        reload: () => void read.mutate(),
        mutate: read.mutate,
    }
}
