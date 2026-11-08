"use client"

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { useMutateDriveLinkedFolderSwr, useMutateDrivePickedFolderSwr } from "@/hooks/swr"
import { googlePickerSettings } from "@/modules/config"
import { isPickedFolder, openDrivePicker, type PickedChoice, type PickedDoc } from "@/modules/googleDrive"
import { readableFilesOf, type DriveFileRow, type DriveListing } from "./drive.shared"

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
    files: docs.filter((doc) => !isPickedFolder(doc)).map((item) => rowOfPicked(item)),
    truncated: false,
    empty: false,
})

/** The view `useDriveListing` returns. */
export interface DriveListingViewShape {
    link: string
    setLink: Dispatch<SetStateAction<string>>
    listing: DriveListing | null
    selected: readonly string[]
    setSelected: Dispatch<SetStateAction<readonly string[]>>
    error: string
    isReading: boolean
    hasPicker: boolean
    readFolder: () => Promise<void>
    pick: () => Promise<void>
    clear: () => void
}

/**
 * Reading what can be added from Google Drive: a folder link (listed with the workspace grant) or Google Picker, where the console has
 * its keys (the token it asks for is used for one listing and never stored). The listing comes back with every readable file ticked.
 */
export const useDriveListing = (failedPickerMessage: string): DriveListingViewShape => {
    const settle = useSettledGraphQL()
    const { trigger: readLinked } = useMutateDriveLinkedFolderSwr()
    const { trigger: readPicked } = useMutateDrivePickedFolderSwr()
    const picker = useMemo(() => googlePickerSettings(), [])
    const [link, setLink] = useState("")
    const [listing, setListing] = useState<DriveListing | null>(null)
    const [selected, setSelected] = useState<ReadonlyArray<string>>([])
    const [error, setError] = useState("")
    const [isReading, setIsReading] = useState(false)

    const show = useCallback((next: DriveListing): void => {
        setListing(next)
        setSelected(readableFilesOf(next).map((file) => file.id))
    }, [])

    const readFolder = useCallback(async (): Promise<void> => {
        setError("")
        setIsReading(true)
        const result = await settle(() => readLinked({ url: link.trim() }))
        setIsReading(false)
        if (result.kind !== "ok") return setError(result.message)
        const folder = result.value
        show({
            name: folder.name,
            files: folder.files.map((item) => rowOf(item)),
            truncated: folder.truncated,
            empty: false,
        })
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
                files: picked.files.map((item) => rowOf(item)),
                truncated: picked.truncated,
                empty: picked.empty,
            })
        },
        [settle, readPicked, show],
    )

    const pick = useCallback(async (): Promise<void> => {
        if (picker === null) return
        setError("")
        setIsReading(true)
        const outcome = await openDrivePicker(picker)
        if (outcome.kind === "chosen") await showChoice(outcome.choice)
        if (outcome.kind === "failed") setError(failedPickerMessage)
        setIsReading(false)
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
