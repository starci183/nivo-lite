import { linkKindOf, linesOfLinks } from "./links"

/** waiting: not sent yet. uploading: bytes on their way to storage. queued: handed to the job queue (a worker reads it from here). */
export type ItemStatus = "waiting" | "uploading" | "queued" | "failed"

/** One row of the queue: a file, a ZIP entry or a link. */
export interface QueueItem {
    readonly id: string
    readonly kind: "file" | "link"
    readonly name: string
    readonly size?: number
    readonly file?: File
    /** Topic used when the topic field is empty (the top-level folder of a ZIP entry). */
    readonly topic?: string
    /** The ZIP and folders it came from, or the service it was chosen in (`google_drive`). */
    readonly origin?: string
    /** The name the document is stored under when the address says less than the person who chose it knew (a Drive file). */
    readonly title?: string
    readonly status: ItemStatus
    /** The catalog key of why it failed. */
    readonly error?: string | undefined
}

/** What a send of one item needs: where it goes and the options chosen once for the batch. */
export interface BatchMeta {
    readonly topic: string | null
    readonly tags: ReadonlyArray<string>
    readonly visibility: string
    readonly module: string | null
    readonly installationId: string | null
}

/** The extra details of one document handed to the job queue, on top of the options chosen for the batch. */
export interface EnqueueMeta extends BatchMeta {
    /** The ZIP and folders the document came from. */
    readonly origin?: string | null
    /** The text of a note or Q&A list (files and links have none). */
    readonly content?: string
}

/** One document handed to the job queue. */
export interface EnqueueItem {
    readonly kind: "file" | "url" | "text" | "faq"
    readonly title: string
    readonly storagePath: string | null
    readonly url: string | null
    readonly meta: EnqueueMeta
}

/** The two things a send needs from the outside: bytes to storage, and a document to the queue. */
export interface QueueActions {
    readonly upload: (file: File) => Promise<string | null>
    readonly enqueue: (input: EnqueueItem) => Promise<boolean>
}

/** The most bytes one file may have. */
export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024

/** The most files one ZIP or folder may bring. */
export const ARCHIVE_MAX_ENTRIES = 300

/** Uploads in flight at once. Only bytes travel from the browser; nothing is read or indexed here. */
export const UPLOAD_PARALLEL = 4

const NO_RETRY: ReadonlySet<string> = new Set([
    "errBadType",
    "errTooBig",
    "errBadLink",
    "errNeedGrant",
    "errNestedZip",
    "errZipBad",
    "errZipTooBig",
    "errZipTotal",
    "errZipBomb",
    "errZipEmpty",
])

/** Whether an item can be sent (again): waiting, or failed for a reason that may pass. */
export const canRetry = (item: Pick<QueueItem, "status" | "error">): boolean =>
    item.status === "waiting" || (item.status === "failed" && !NO_RETRY.has(item.error ?? ""))

/** The links typed in the rows that are not in the queue yet and can be added. */
export const typedLinks = (links: string, items: ReadonlyArray<QueueItem>): ReadonlyArray<string> =>
    linesOfLinks(links).filter(
        (url) =>
            /^https?:\/\//i.test(url) &&
            linkKindOf(url) !== "invalid" &&
            !items.some((one) => one.kind === "link" && one.name === url),
    )

/** A file name without its folders and extension. */
export const stripExt = (name: string): string => (name.split(/[\\/]/).pop() ?? name).replace(/\.[^.]+$/, "")
