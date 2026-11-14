import type { AgentModule, BatchMeta, ChosenLink, LinkInput, QueueItem } from "@/modules/documents"
import type { ClipboardEvent } from "react"

/** What was skipped in an archive: its name and how many entries could not be read. */
export interface ZipSkip {
    readonly name: string
    readonly count: number
}

/** What the queue gives the drawer. */
export interface AddQueue {
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

/** What the links list gives the drawer. */
export interface LinkRows {
    readonly rows: ReadonlyArray<LinkInput>
    /** Why each row cannot be added, by row id (the catalog key). */
    readonly errors: Readonly<Record<string, string>>
    /** The links typed or pasted, one per line. */
    readonly links: string
    readonly setValue: (id: string, value: string) => void
    readonly add: () => void
    readonly remove: (id: string) => void
    readonly validate: (id: string) => void
    readonly paste: (id: string, event: ClipboardEvent<HTMLInputElement>) => void
    readonly clear: () => void
}

/** One question and its answer, with the identity that keeps its row when another is removed. */
export interface FaqEntry {
    readonly id: string
    readonly q: string
    readonly a: string
}

/** The note or list of questions as the person typed it. */
export interface NoteDraftFields {
    readonly title: string
    readonly content: string
    readonly pairs: ReadonlyArray<FaqEntry>
    /** The person pressed add with something missing. */
    readonly tried: boolean
}

/** What the note draft gives the drawer. */
export interface NoteDraft extends NoteDraftFields {
    readonly setTitle: (value: string) => void
    readonly setContent: (value: string) => void
    readonly setPair: (id: string, field: "q" | "a", value: string) => void
    readonly addPair: () => void
    readonly removePair: (id: string) => void
    readonly setTried: (value: boolean) => void
    readonly reset: () => void
}

/** Opens the form with a topic (and tags) already chosen: on "Write" for a suggestion, on the files of a category. */
export interface AddPreset {
    readonly topic: string
    /** Comma-separated tags the batch carries, e.g. the one that files a document under a category. */
    readonly tags?: string
    /** The mode the drawer opens on; "write" when absent. */
    readonly mode?: "files" | "write"
}

/** The options of the batch as the person chose them. */
export interface BatchOptionFields {
    readonly topic: string
    readonly tags: string
    readonly module: AgentModule | "all"
    readonly instanceId: string | null
}

/** What the batch options give the drawer. */
export interface BatchOptions extends BatchOptionFields {
    /** The value the "For" select shows. */
    readonly moduleValue: string
    readonly setTopic: (value: string) => void
    readonly setTags: (value: string) => void
    readonly pickModule: (value: string | null) => void
    /** The options in the form a send needs. */
    readonly meta: () => BatchMeta
}

/** A document this drawer handed to the queue: its id and the name it was given. */
export interface QueuedDoc {
    readonly id: string
    readonly title: string
}

/** What the drawer is adding: files and links, a written note, or a list of questions and answers. */
export type AddMode = "files" | "write" | "faq"

/** The view `useAddDocuments` returns. */
export interface AddDocumentsView {
    queue: AddQueue
    linkRows: LinkRows
    note: NoteDraft
    options: BatchOptions
    mode: AddMode
    isBusy: boolean
    failure: string | null
    queuedCount: number
    queuedDocs: readonly QueuedDoc[]
    pendingCount: number
    hasFailed: boolean
    isDone: boolean
    noteBody: string
    pickMode: (key: string) => void
    submit: () => undefined
    retryItem: (id: string) => undefined
    close: () => void
}
