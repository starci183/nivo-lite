"use client"

import { canRetry, linkProblemOf, pairsToText, typedLinks } from "@/modules/documents"
import type { InstanceOption, QaLabels, QueueActions } from "@/modules/documents"
import { useState } from "react"
import { useAddQueue } from "./useAddQueue"
import { useBatchOptions } from "./useBatchOptions"
import type { AddPreset } from "./useBatchOptions"
import { useLinkRows } from "./useLinkRows"
import { useNoteDraft } from "./useNoteDraft"

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

    const noteBody = mode === "faq" ? pairsToText(note.pairs, faqLabels) : note.content
    const retryable = queue.items.filter(canRetry)
    const typed = typedLinks(linkRows.links, queue.items).filter((url) => linkProblemOf(url) === null)
    const pendingCount = retryable.length + typed.length
    const isNoteEmpty = note.title.trim() === "" || noteBody.trim() === ""
    const isEmpty = mode === "files" ? pendingCount === 0 : isNoteEmpty
    const isDone = isDocumentBatchDone(queuedCount, isBusy, mode, pendingCount, note.title, noteBody)

    const runBatch = createDocumentBatchRunner(queue, linkRows, retryable, options)

    const runNote = async () => {
        const queued = await actions.enqueue({
            kind: mode === "faq" ? "faq" : "text",
            title: note.title.trim(),
            storagePath: null,
            url: null,
            meta: { ...options.meta(), content: noteBody },
        })
        if (queued) note.reset()
        else setFailure("errEnqueue")
        return queued ? 1 : 0
    }

    const retryItem = async (id: string) => {
        const item = queue.items.find((one) => one.id === id)
        if (isBusy || item === undefined || !canRetry(item)) return
        setBusy(true)
        setFailure(null)
        const queued = await queue.sendAll([item], options.meta())
        setBusy(false)
        setQueuedCount((now) => now + queued)
        if (queued > 0) input.onAdded()
    }

    const close = () => {
        if (isBusy) return
        queue.reset()
        linkRows.clear()
        note.reset()
        setFailure(null)
        setQueuedCount(0)
        input.onClose()
    }

    const submit = async () => {
        if (isDone) return close()
        if (isEmpty) return note.setTried(true)
        note.setTried(false)
        setBusy(true)
        setFailure(null)
        const queued = await (mode === "files" ? runBatch() : runNote())
        setBusy(false)
        setQueuedCount((now) => now + queued)
        if (queued > 0) input.onAdded()
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
        return waiting.length === 0 ? 0 : queue.sendAll(waiting, options.meta())
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
