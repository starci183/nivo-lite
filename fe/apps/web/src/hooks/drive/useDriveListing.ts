"use client"

import { useCallback, useMemo, useState } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { useMutateDriveLinkedFolderSwr, useMutateDrivePickedFolderSwr } from "@/hooks/swr"
import { googlePickerSettings } from "@/modules/config"
import { isPickedFolder, openDrivePicker } from "@/modules/googleDrive"
import type { PickedChoice, PickedDoc } from "@/modules/googleDrive"
import { readableFilesOf } from "./drive.shared"
import type { DriveFileRow, DriveListing } from "./drive.shared"

/** What the files of a folder carry on the wire. */
interface WireFile {
    readonly id: string
    readonly name: string
    readonly path: string
    readonly mimeType: string
    readonly size?: number | null | undefined
    readonly modifiedTime?: string | null | undefined
    readonly url: string
}

const rowOf = (file: WireFile): DriveFileRow => ({
    id: file.id,
    name: file.name,
    path: file.path,
    mimeType: file.mimeType,
    sizeBytes: file.size ?? null,
    modifiedTime: file.modifiedTime ?? null,
    url: file.url,
})

const rowOfPicked = (doc: PickedDoc): DriveFileRow => ({
    id: doc.id,
    name: doc.name,
    path: "",
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    modifiedTime: doc.modifiedTime,
    url: doc.url,
})

/** The files the owner chose directly in Picker, as a listing with no folder. */
const listingOfChosenFiles = (docs: ReadonlyArray<PickedDoc>): DriveListing => ({
    name: "",
    files: docs.filter((doc) => !isPickedFolder(doc)).map(rowOfPicked),
    truncated: false,
    empty: false,
})

/**
 * Reading what can be added from Google Drive: a folder link (listed with the workspace grant) or Google Picker, where the console has
 * its keys (the token it asks for is used for one listing and never stored). The listing comes back with every readable file ticked.
 */
export const useDriveListing = (failedPickerMessage: string) => {
    const settle = useSettledGraphQL()
    const { trigger: readLinked } = useMutateDriveLinkedFolderSwr()
    const { trigger: readPicked } = useMutateDrivePickedFolderSwr()
    const picker = useMemo(() => googlePickerSettings(), [])
    const [link, setLink] = useState("")
    const [listing, setListing] = useState<DriveListing | null>(null)
    const [selected, setSelected] = useState<ReadonlyArray<string>>([])
    const [error, setError] = useState("")
    const [isReading, setReading] = useState(false)

    const show = useCallback((next: DriveListing): void => {
        setListing(next)
        setSelected(readableFilesOf(next).map((file) => file.id))
    }, [])

    const readFolder = useCallback(async (): Promise<void> => {
        setError("")
        setReading(true)
        const result = await settle(() => readLinked({ url: link.trim() }))
        setReading(false)
        if (result.kind !== "ok") return setError(result.message)
        const folder = result.value
        show({ name: folder.name, files: folder.files.map(rowOf), truncated: folder.truncated, empty: false })
    }, [settle, readLinked, link, show])

    const showChoice = useCallback(
        async (choice: PickedChoice): Promise<void> => {
            const folder = choice.docs.find(isPickedFolder)
            if (folder === undefined) return show(listingOfChosenFiles(choice.docs))
            const result = await settle(() => readPicked({ folderId: folder.id, token: choice.token }))
            if (result.kind !== "ok") return setError(result.message)
            const picked = result.value
            show({
                name: picked.name,
                files: picked.files.map(rowOf),
                truncated: picked.truncated,
                empty: picked.empty,
            })
        },
        [settle, readPicked, show],
    )

    const pick = useCallback(async (): Promise<void> => {
        if (picker === null) return
        setError("")
        setReading(true)
        const outcome = await openDrivePicker(picker)
        if (outcome.kind === "chosen") await showChoice(outcome.choice)
        if (outcome.kind === "failed") setError(failedPickerMessage)
        setReading(false)
    }, [picker, showChoice, failedPickerMessage])

    const clear = useCallback((): void => {
        setListing(null)
        setSelected([])
        setLink("")
    }, [])

    return {
        link,
        setLink,
        listing,
        selected,
        setSelected,
        error,
        isReading,
        hasPicker: picker !== null,
        readFolder,
        pick,
        clear,
    }
}
