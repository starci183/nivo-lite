"use client"

import { useCallback, useState } from "react"
import { useAddQueue, useQueueActions } from "@/hooks/knowledge"
import { DRIVE_ORIGIN, isReadableDriveFile } from "./drive.shared"
import type { DriveListing } from "./drive.shared"
import { useDriveListing } from "./useDriveListing"

/** Who may read the documents being added. */
export type DriveVisibility = "internal" | "public"

/** What one add needs from the listing the owner ticked. */
interface DriveAddInput {
    readonly listing: DriveListing | null
    readonly selected: ReadonlyArray<string>
    /** Called once the files are queued, so the listing can be cleared. */
    readonly onSent: () => void
}

/**
 * Adding the ticked files: ordinary link sources marked `google_drive`, stored under their own file names, who may use them as chosen,
 * through the same queue as every other document (one `enqueueKnowledgeSource` each, with its per-item errors).
 */
const useDriveAdd = (input: DriveAddInput) => {
    const queue = useAddQueue(useQueueActions())
    const [visibility, setVisibility] = useState<DriveVisibility>("internal")
    const [isAdding, setAdding] = useState(false)
    const [added, setAdded] = useState(0)
    const { listing, selected, onSent } = input
    const add = useCallback(async (): Promise<void> => {
        if (listing === null) return
        const chosen = listing.files.filter((file) => selected.includes(file.id) && isReadableDriveFile(file))
        setAdding(true)
        const items = queue.addChosenLinks(
            chosen.map((file) => ({ url: file.url, title: file.name })),
            DRIVE_ORIGIN,
        )
        const sent = await queue.sendAll(items, { topic: null, tags: [], visibility, module: null, installationId: null })
        queue.reset()
        setAdding(false)
        setAdded(sent)
        onSent()
    }, [listing, selected, queue, visibility, onSent])
    return { visibility, setVisibility, isAdding, added, add, reset: () => setAdded(0) }
}

/**
 * The choose step of Google Drive, shared by the page and the hub wizard: read a folder link (or choose in Google Picker where the
 * console has its keys), tick the files NIVO can read, pick who may use them, and add them.
 */
export const useDriveChoose = (failedPickerMessage: string) => {
    const reading = useDriveListing(failedPickerMessage)
    const adding = useDriveAdd({ listing: reading.listing, selected: reading.selected, onSent: reading.clear })
    return { ...reading, ...adding, pick: () => void reading.pick(), add: () => void adding.add() }
}
