"use client"

import { useState } from "react"
import type { QueueItem } from "@/modules/documents"

/** A document this drawer handed to the queue: its id and the name it was given. */
export interface QueuedDoc {
    readonly id: string
    readonly title: string
}

/** What the queued documents give the drawer. */
interface QueuedDocs {
    /** Every document the drawer queued: the files and links of the queue, then the notes. */
    readonly docs: ReadonlyArray<QueuedDoc>
    /** Remembers a note that was queued. */
    readonly recordNote: (doc: QueuedDoc) => void
    /** Forgets the notes: the drawer was closed. */
    readonly reset: () => void
}

/** The documents the drawer queued, so the progress of each can be looked up: a queue item holds its id once handed over, a note is told here. */
export const useQueuedDocs = (items: ReadonlyArray<QueueItem>): QueuedDocs => {
    const [notes, setNotes] = useState<ReadonlyArray<QueuedDoc>>([])
    return {
        docs: [
            ...items.flatMap((item) =>
                item.sourceId === undefined ? [] : [{ id: item.sourceId, title: item.title ?? item.name }],
            ),
            ...notes,
        ],
        recordNote: (doc) => setNotes((now) => [...now, doc]),
        reset: () => setNotes([]),
    }
}
