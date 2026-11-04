import { canRetry, typedLinks, type QueueActions } from "@/modules/documents"
import type { AddMode, AddQueue, BatchOptions, LinkRows, NoteDraft, QueuedDoc } from "@/hooks/knowledgeAddTypes"

/** What the note runner reads from the drawer. */
interface NoteRunnerInput {
    readonly actions: QueueActions
    readonly mode: AddMode
    readonly note: NoteDraft
    readonly noteBody: string
    readonly options: BatchOptions
}

/** What the note runner tells the drawer: the note was refused, or it was queued as this document. */
interface NoteRunnerEvents {
    readonly fail: () => void
    readonly record: (doc: QueuedDoc) => void
}

/** What `createNoteRunner` returns. */
export type CreateNoteRunnerResult = () => Promise<0 | 1>

/** Builds the command that queues the written note or the questions; answers how many were queued. */
export const createNoteRunner =
    (input: NoteRunnerInput, on: NoteRunnerEvents): CreateNoteRunnerResult =>
    async () => {
        const title = input.note.title.trim()
        const id = await input.actions.enqueue({
            kind: input.mode === "faq" ? "faq" : "text",
            title,
            storagePath: null,
            url: null,
            meta: { ...input.options.meta(), content: input.noteBody },
        })
        if (id === null) {
            on.fail()
            return 0
        }
        input.note.reset()
        on.record({ id, title })
        return 1
    }

/** How a send tells the drawer it has begun and how many documents it queued. */
interface BatchTracker {
    readonly begin: () => void
    readonly end: (queued: number) => void
}

/** What `createItemRetry` returns. */
export type CreateItemRetryResult = (id: string) => Promise<void>

/** Builds the command that sends one failed item again. */
export const createItemRetry =
    (queue: AddQueue, options: BatchOptions, isBusy: boolean, batch: BatchTracker): CreateItemRetryResult =>
    async (id: string) => {
        const item = queue.items.find((one) => one.id === id)
        if (isBusy || item === undefined || !canRetry(item)) return
        batch.begin()
        batch.end(await queue.sendAll([item], options.meta()))
    }

/** What `createDocumentBatchRunner` returns. */
export type CreateDocumentBatchRunnerResult = () => Promise<number>

/** Builds the runBatch command from the current render state. */
export const createDocumentBatchRunner =
    (
        queue: AddQueue,
        linkRows: LinkRows,
        retryable: AddQueue["items"],
        options: BatchOptions,
    ): CreateDocumentBatchRunnerResult =>
    async () => {
        // Links still sitting in the inputs join the queue first.
        const added = queue.addLinks(typedLinks(linkRows.links, queue.items))
        if (added.length > 0) linkRows.clear()
        const waiting = [...retryable, ...added.filter((item) => item.status === "waiting")]
        const meta = options.meta()
        return waiting.length === 0 ? 0 : queue.sendAll(waiting, meta)
    }
