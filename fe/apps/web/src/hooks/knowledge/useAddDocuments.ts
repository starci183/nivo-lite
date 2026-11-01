"use client"

import { canRetry, linkProblemOf, pairsToText, typedLinks } from "@/modules/documents"
import type { InstanceOption, QaLabels, QueueActions } from "@/modules/documents"
import { useState } from "react"
import { useAddQueue } from "./useAddQueue"
import { useBatchOptions } from "./useBatchOptions"
import type { AddPreset } from "./useBatchOptions"
import { useLinkRows } from "./useLinkRows"
import { useNoteDraft } from "./useNoteDraft"
import { useQueuedDocs, type QueuedDoc } from "./useQueuedDocs"

/** What the drawer is adding: files and links, a written note, or a list of questions and answers. */
export type AddMode = "files" | "write" | "faq"

/** What the drawer needs from the page and the outside. */
export interface AddDocumentsInput {
    readonly actions: QueueActions
    readonly instances: ReadonlyArray<InstanceOption>
    readonly preset: AddPreset | null
    /** The words that label a question and an answer in the stored text. */
    readonly faqLabels: QaLabels
    readonly onAdded: () => void
    readonly onClose: () => void
}

/** The mode a mode key stands for. */
const modeOf = (key: string): AddMode => {
    if (key === "write") return "write"
    return key === "faq" ? "faq" : "files"
}

/** The state and commands of the Add documents drawer. */
export const useAddDocuments = (input: AddDocumentsInput) => {
    const { actions, instances, preset, faqLabels } = input
    const queue = useAddQueue(actions)
    const linkRows = useLinkRows()
    const note = useNoteDraft()
    const options = useBatchOptions(preset, instances)
    const [mode, setMode] = useState<AddMode>(preset === null ? "files" : (preset.mode ?? "write"))
    const [isBusy, setBusy] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)
    const [queuedCount, setQueuedCount] = useState(0)
    const queued = useQueuedDocs(queue.items)
    const noteBody = mode === "faq" ? pairsToText(note.pairs, faqLabels) : note.content
    const retryable = queue.items.filter(canRetry)
    const typed = typedLinks(linkRows.links, queue.items).filter((url) => linkProblemOf(url) === null)
    const pendingCount = retryable.length + typed.length
    const isNoteEmpty = note.title.trim() === "" || noteBody.trim() === ""
    const isEmpty = mode === "files" ? pendingCount === 0 : isNoteEmpty
    const isDone = isDocumentBatchDone(queuedCount, isBusy, mode, pendingCount, note.title, noteBody)
    const runBatch = createDocumentBatchRunner(queue, linkRows, retryable, options)
    const batch = {
        begin: () => {
            setBusy(true)
            setFailure(null)
        },
        end: (queued: number) => {
            setBusy(false)
            setQueuedCount((now) => now + queued)
            if (queued > 0) input.onAdded()
        },
    }
    const runNote = createNoteRunner(
        { actions, mode, note, noteBody, options },
        { fail: () => setFailure("errEnqueue"), record: queued.recordNote },
    )
    const retryItem = createItemRetry(queue, options, isBusy, batch)
    const close = () => {
        if (isBusy) return
        queue.reset()
        linkRows.clear()
        note.reset()
        setFailure(null)
        setQueuedCount(0)
        queued.reset()
        input.onClose()
    }

    const submit = async () => {
        if (isDone) return close()
        if (isEmpty) return note.setTried(true)
        if (options.visibility === null) return
        note.setTried(false)
        batch.begin()
        batch.end(await (mode === "files" ? runBatch() : runNote()))
    }

    return {
        queue,
        linkRows,
        note,
        options,
        mode,
        isBusy,
        failure,
        queuedCount,
        queuedDocs: queued.docs,
        pendingCount,
        hasFailed: queue.items.some((item) => item.status === "failed"),
        isDone,
        noteBody,
        pickMode: (key: string) => {
            if (isBusy) return
            setMode(modeOf(key))
            note.setTried(false)
        },
        submit: () => void submit(),
        retryItem: (id: string) => void retryItem(id),
        close,
    }
}

/** What the note runner reads from the drawer. */
interface NoteRunnerInput {
    readonly actions: QueueActions
    readonly mode: AddMode
    readonly note: ReturnType<typeof useNoteDraft>
    readonly noteBody: string
    readonly options: ReturnType<typeof useBatchOptions>
}

/** What the note runner tells the drawer: the note was refused, or it was queued as this document. */
interface NoteRunnerEvents {
    readonly fail: () => void
    readonly record: (doc: QueuedDoc) => void
}

/** Builds the command that queues the written note or the questions; answers how many were queued. */
const createNoteRunner = (input: NoteRunnerInput, on: NoteRunnerEvents) => async () => {
    const title = input.note.title.trim()
    const meta = input.options.meta()
    if (meta === null) return 0
    const id = await input.actions.enqueue({
        kind: input.mode === "faq" ? "faq" : "text",
        title,
        storagePath: null,
        url: null,
        meta: { ...meta, content: input.noteBody },
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

/** Builds the command that sends one failed item again. */
const createItemRetry =
    (
        queue: ReturnType<typeof useAddQueue>,
        options: ReturnType<typeof useBatchOptions>,
        isBusy: boolean,
        batch: BatchTracker,
    ) =>
    async (id: string) => {
        const item = queue.items.find((one) => one.id === id)
        const meta = options.meta()
        if (isBusy || item === undefined || meta === null || !canRetry(item)) return
        batch.begin()
        batch.end(await queue.sendAll([item], meta))
    }

/** Builds the runBatch command from the current render state. */
const createDocumentBatchRunner =
    (
        queue: ReturnType<typeof useAddQueue>,
        linkRows: ReturnType<typeof useLinkRows>,
        retryable: ReturnType<typeof useAddQueue>["items"],
        options: ReturnType<typeof useBatchOptions>,
    ) =>
    async () => {
        // Links still sitting in the inputs join the queue first.
        const added = queue.addLinks(typedLinks(linkRows.links, queue.items))
        if (added.length > 0) linkRows.clear()
        const waiting = [...retryable, ...added.filter((item) => item.status === "waiting")]
        const meta = options.meta()
        return waiting.length === 0 || meta === null ? 0 : queue.sendAll(waiting, meta)
    }

/** Whether every submitted document has completed and no draft remains. */
const isDocumentBatchDone = (
    queuedCount: number,
    isBusy: boolean,
    mode: AddMode,
    pendingCount: number,
    title: string,
    noteBody: string,
) =>
    queuedCount > 0 &&
    !isBusy &&
    (mode === "files" ? pendingCount === 0 : title.trim() === "" && noteBody.trim() === "")
