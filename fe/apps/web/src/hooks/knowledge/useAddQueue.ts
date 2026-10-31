"use client"

import {
    ARCHIVE_MAX_ENTRIES,
    UPLOAD_PARALLEL,
    isArchiveName,
    itemOfFile,
    itemOfLink,
    itemsOfZip,
    readArchive,
    stripExt,
} from "@/modules/documents"
import type { BatchMeta, QueueActions, QueueItem } from "@/modules/documents"
import { useRef, useState } from "react"

/** What was skipped in an archive: its name and how many entries could not be read. */
interface ZipSkip {
    readonly name: string
    readonly count: number
}

/** A link chosen in a service: its address and the name the document is stored under. */
export interface ChosenLink {
    readonly url: string
    readonly title: string
}

/** What the queue gives the drawer. */
interface AddQueue {
    readonly items: ReadonlyArray<QueueItem>
    readonly isReading: boolean
    readonly zipTruncated: boolean
    readonly zipSkips: ReadonlyArray<ZipSkip>
    readonly addFiles: (all: ReadonlyArray<File>) => void
    readonly addLinks: (urls: ReadonlyArray<string>) => ReadonlyArray<QueueItem>
    /** Adds links the person chose in a service (a Drive file), each stored under its own name and marked with where it came from. */
    readonly addChosenLinks: (links: ReadonlyArray<ChosenLink>, origin: string) => ReadonlyArray<QueueItem>
    readonly removeItem: (id: string) => void
    /** Sends every item that can be sent, a few at a time; answers how many were queued. */
    readonly sendAll: (queue: ReadonlyArray<QueueItem>, meta: BatchMeta) => Promise<number>
    readonly reset: () => void
}

const isSameFile = (one: QueueItem, file: File): boolean =>
    one.kind === "file" && one.name === file.name && one.size === file.size

/** The queue items of links chosen in a service, leaving out the ones already queued. */
const chosenItemsOf = (
    queued: ReadonlyArray<QueueItem>,
    links: ReadonlyArray<ChosenLink>,
    origin: string,
): ReadonlyArray<QueueItem> =>
    links
        .filter((link) => !queued.some((one) => one.kind === "link" && one.name === link.url))
        .map((link) => ({ ...itemOfLink(link.url), title: link.title, origin }))

/** The queue of files and links of the Add documents drawer: files and archive entries are checked, then uploaded and handed to the job queue. */
export const useAddQueue = (actions: QueueActions): AddQueue => {
    const [items, setItems] = useState<ReadonlyArray<QueueItem>>([])
    const [isReading, setReading] = useState(false)
    const [zipTruncated, setZipTruncated] = useState(false)
    const [zipSkips, setZipSkips] = useState<ReadonlyArray<ZipSkip>>([])
    const zipSeen = useRef<Set<string>>(new Set())

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
        setItems((now) => {
            const fresh = files.reduce<ReadonlyArray<File>>(
                (kept, file) =>
                    now.some((one) => isSameFile(one, file)) ||
                    kept.some((one) => one.name === file.name && one.size === file.size)
                        ? kept
                        : [...kept, file],
                [],
            )
            return [...now, ...fresh.map(itemOfFile)]
        })
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

    return {
        items,
        isReading,
        zipTruncated,
        zipSkips,
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

const sendAllOf = (sendOne: (item: QueueItem, meta: BatchMeta) => Promise<boolean>) => {
    return async (queue: ReadonlyArray<QueueItem>, meta: BatchMeta): Promise<number> => {
        let next = 0
        const lane = async (): Promise<number> => {
            const item = queue[next]
            next += 1
            if (item === undefined) return 0
            const sent = (await sendOne(item, meta)) ? 1 : 0
            return sent + (await lane())
        }
        const lanes = await Promise.all(Array.from({ length: Math.min(UPLOAD_PARALLEL, queue.length) }, lane))
        return lanes.reduce((sum, count) => sum + count, 0)
    }
}

const sendOneOf = (patch: (id: string, change: Partial<QueueItem>) => void, actions: QueueActions) => {
    return async (item: QueueItem, meta: BatchMeta): Promise<boolean> => {
        patch(item.id, { status: "uploading", error: undefined })
        const info = {
            topic: meta.topic ?? item.topic ?? null,
            tags: meta.tags,
            visibility: meta.visibility,
            module: meta.module,
            installationId: meta.installationId,
            origin: item.origin ?? null,
        }
        const path = item.file === undefined ? null : await actions.upload(item.file)
        if (item.kind === "file" && path === null) {
            patch(item.id, { status: "failed", error: "errUpload" })
            return false
        }
        const queued = await actions.enqueue({
            kind: item.kind === "link" ? "url" : "file",
            title: item.title ?? (item.kind === "link" ? item.name.replace(/^https?:\/\//i, "") : stripExt(item.name)),
            storagePath: path,
            url: item.kind === "link" ? item.name : null,
            meta: info,
        })
        patch(item.id, queued ? { status: "queued" } : { status: "failed", error: "errEnqueue" })
        return queued
    }
}
