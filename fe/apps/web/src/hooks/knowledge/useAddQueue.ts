"use client"

import {
    ARCHIVE_MAX_ENTRIES,
    chosenItemsOf,
    forgetUploads,
    interruptedUploads,
    isArchiveName,
    itemOfLink,
    itemsOfZip,
    readArchive,
    sendAllOf,
    sendOneOf,
    withFiles,
} from "@/modules/documents"
import type { BatchMeta, ChosenLink, QueueActions, QueueItem } from "@/modules/documents"
import { useRef, useState } from "react"

/** What was skipped in an archive: its name and how many entries could not be read. */
interface ZipSkip {
    readonly name: string
    readonly count: number
}

/** What the queue gives the drawer. */
interface AddQueue {
    readonly items: ReadonlyArray<QueueItem>
    readonly isReading: boolean
    readonly zipTruncated: boolean
    readonly zipSkips: ReadonlyArray<ZipSkip>
    /** Files an earlier page was uploading when it went away: those uploads stopped and must be chosen again. */
    readonly interrupted: ReadonlyArray<string>
    readonly dismissInterrupted: () => void
    readonly addFiles: (all: ReadonlyArray<File>) => void
    readonly addLinks: (urls: ReadonlyArray<string>) => ReadonlyArray<QueueItem>
    /** Adds links the person chose in a service (a Drive file), each stored under its own name and marked with where it came from. */
    readonly addChosenLinks: (links: ReadonlyArray<ChosenLink>, origin: string) => ReadonlyArray<QueueItem>
    readonly removeItem: (id: string) => void
    /** Sends every item that can be sent, a few at a time; answers how many were queued. */
    readonly sendAll: (queue: ReadonlyArray<QueueItem>, meta: BatchMeta) => Promise<number>
    readonly reset: () => void
}

/** The queue of files and links of the Add documents drawer: files and archive entries are checked, then uploaded and handed to the job queue. */
export const useAddQueue = (actions: QueueActions): AddQueue => {
    const [items, setItems] = useState<ReadonlyArray<QueueItem>>([])
    const [isReading, setReading] = useState(false)
    const [zipTruncated, setZipTruncated] = useState(false)
    const [zipSkips, setZipSkips] = useState<ReadonlyArray<ZipSkip>>([])
    const zipSeen = useRef<Set<string>>(new Set())
    const [interrupted, setInterrupted] = useState<ReadonlyArray<string>>(interruptedUploads)

    const patch = (id: string, change: Partial<QueueItem>) =>
        setItems((now) => now.map((item) => (item.id === id ? { ...item, ...change } : item)))

    const addZip = async (zip: File): Promise<void> => {
        const key = `${zip.name}:${zip.size}`
        if (zipSeen.current.has(key)) return
        zipSeen.current.add(key)
        const result = await readArchive(zip, ARCHIVE_MAX_ENTRIES)
        if (result.truncated) setZipTruncated(true)
        if (result.skipped > 0) setZipSkips((now) => [...now, { name: zip.name, count: result.skipped }])
        setItems((now) => [...now, ...itemsOfZip(zip, result)])
    }

    const addZips = (zips: ReadonlyArray<File>) => {
        setReading(true)
        const opened = zips.reduce<Promise<void>>((chain, zip) => chain.then(() => addZip(zip)), Promise.resolve())
        void opened.then(() => setReading(false))
    }

    const addFiles = (all: ReadonlyArray<File>) => {
        const zips = all.filter((file) => isArchiveName(file.name))
        const files = all.filter((file) => !isArchiveName(file.name))
        if (zips.length > 0) addZips(zips)
        if (files.length === 0) return
        setItems((now) => withFiles(now, files))
    }

    const addLinks = (urls: ReadonlyArray<string>): ReadonlyArray<QueueItem> => {
        const fresh = urls
            .filter((url) => !items.some((one) => one.kind === "link" && one.name === url))
            .map(itemOfLink)
        setItems((now) => [...now, ...fresh])
        return fresh
    }

    const addChosenLinks = (links: ReadonlyArray<ChosenLink>, origin: string): ReadonlyArray<QueueItem> => {
        const fresh = chosenItemsOf(items, links, origin)
        setItems((now) => [...now, ...fresh])
        return fresh
    }

    const sendOne = sendOneOf(patch, actions)

    const sendAll = sendAllOf(sendOne)
    const dismissInterrupted = () => {
        forgetUploads()
        setInterrupted([])
    }

    return {
        items,
        isReading,
        zipTruncated,
        zipSkips,
        interrupted,
        dismissInterrupted,
        addFiles,
        addLinks,
        addChosenLinks,
        removeItem: (id) => setItems((now) => now.filter((one) => one.id !== id)),
        sendAll,
        reset: () => {
            setItems([])
            setZipTruncated(false)
            setZipSkips([])
            zipSeen.current = new Set()
        },
    }
}
