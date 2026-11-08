"use client"

import {
    canRetry,
    linkProblemOf,
    pairsToText,
    typedLinks,
    type InstanceOption,
    type QaLabels,
    type QueueActions,
} from "@/modules/documents"
import { useState } from "react"
import { useAddQueue } from "./useAddQueue"
import { useBatchOptions } from "./useBatchOptions"
import { useLinkRows } from "./useLinkRows"
import { useNoteDraft } from "./useNoteDraft"
import { useQueuedDocs } from "./useQueuedDocs"
import { createDocumentBatchRunner, createItemRetry, createNoteRunner } from "@/hooks/knowledgeAddRunners"
import type { AddDocumentsView, AddMode, AddPreset } from "@/hooks/knowledgeAddTypes"

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
export const useAddDocuments = (input: AddDocumentsInput): AddDocumentsView => {
    const { actions, instances, preset, faqLabels } = input
    const queue = useAddQueue(actions)
    const linkRows = useLinkRows()
    const note = useNoteDraft()
    const options = useBatchOptions(preset, instances)
    const [mode, setMode] = useState<AddMode>(preset === null ? "files" : (preset.mode ?? "write"))
    const [isBusy, setIsBusy] = useState(false)
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
            setIsBusy(true)
            setFailure(null)
        },
        end: (queued: number) => {
            setIsBusy(false)
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
