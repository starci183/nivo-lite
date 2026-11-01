import { itemOfFile, itemOfLink } from "./queue-items"
import { UPLOAD_PARALLEL, stripExt } from "./queue"
import type { BatchMeta, QueueActions, QueueItem } from "./queue"
import { forgetUploads, rememberUploads } from "./upload-marker"

/** A link chosen in a service: its address and the name the document is stored under. */
export interface ChosenLink {
    readonly url: string
    readonly title: string
}

const isSameFile = (one: QueueItem, file: File): boolean =>
    one.kind === "file" && one.name === file.name && one.size === file.size

/** The queue with the chosen files added, leaving out the ones already queued or chosen twice. */
export const withFiles = (queued: ReadonlyArray<QueueItem>, files: ReadonlyArray<File>): ReadonlyArray<QueueItem> => {
    const fresh = files.reduce<ReadonlyArray<File>>(
        (kept, file) =>
            queued.some((one) => isSameFile(one, file)) ||
            kept.some((one) => one.name === file.name && one.size === file.size)
                ? kept
                : [...kept, file],
        [],
    )
    return [...queued, ...fresh.map(itemOfFile)]
}

/** The queue items of links chosen in a service, leaving out the ones already queued. */
export const chosenItemsOf = (
    queued: ReadonlyArray<QueueItem>,
    links: ReadonlyArray<ChosenLink>,
    origin: string,
): ReadonlyArray<QueueItem> =>
    links
        .filter((link) => !queued.some((one) => one.kind === "link" && one.name === link.url))
        .map((link) => ({ ...itemOfLink(link.url), title: link.title, origin }))

/** Sends every item of a queue, a few at a time; answers how many were queued. */
export const sendAllOf = (sendOne: (item: QueueItem, meta: BatchMeta) => Promise<boolean>) => {
    return async (queue: ReadonlyArray<QueueItem>, meta: BatchMeta): Promise<number> => {
        rememberUploads(
            queue.flatMap((item) => (item.file === undefined ? [] : [item.name])),
            Date.now(),
        )
        let next = 0
        const lane = async (): Promise<number> => {
            const item = queue[next]
            next += 1
            if (item === undefined) return 0
            const sent = (await sendOne(item, meta)) ? 1 : 0
            return sent + (await lane())
        }
        const lanes = await Promise.all(Array.from({ length: Math.min(UPLOAD_PARALLEL, queue.length) }, lane))
        forgetUploads()
        return lanes.reduce((sum, count) => sum + count, 0)
    }
}

/** Sends one item: its bytes to storage, then the document to the job queue. */
export const sendOneOf = (patch: (id: string, change: Partial<QueueItem>) => void, actions: QueueActions) => {
    return async (item: QueueItem, meta: BatchMeta): Promise<boolean> => {
        patch(item.id, { status: "uploading", error: undefined, uploaded: 0 })
        const info = {
            topic: meta.topic ?? item.topic ?? null,
            tags: meta.tags,
            visibility: meta.visibility,
            module: meta.module,
            installationId: meta.installationId,
            origin: item.origin ?? null,
        }
        const path =
            item.file === undefined
                ? null
                : (item.storagePath ??
                  (await actions.upload(item.file, (fraction) => patch(item.id, { uploaded: Math.min(fraction, 1) }))))
        if (item.kind === "file" && path === null) {
            patch(item.id, { status: "failed", error: "errUpload" })
            return false
        }
        if (path !== null) patch(item.id, { uploaded: 1, storagePath: path })
        const queued = await actions.enqueue({
            kind: item.kind === "link" ? "url" : "file",
            title: item.title ?? (item.kind === "link" ? item.name.replace(/^https?:\/\//i, "") : stripExt(item.name)),
            storagePath: path,
            url: item.kind === "link" ? item.name : null,
            meta: info,
        })
        patch(
            item.id,
            queued
                ? { status: "queued", uploaded: undefined }
                : { status: "failed", error: "errEnqueue", uploaded: undefined },
        )
        return queued
    }
}
