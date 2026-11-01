"use client"

import { useAddDocumentsView } from "@/hooks/knowledge"
import { useAddProgress } from "@/hooks/brain"
import type { AddPreset, ModuleKey } from "@/hooks/knowledge"
import { KnowledgeAddBase } from "./component"

/** Props for the connected add documents drawer. */
interface KnowledgeAddProps {
    /** The words shown instead of the drop zone to members who may only read. */
    readonly readOnlyNote: string
    /** The agent the list of documents is filtered to; the drawer returns to it when it closes. */
    readonly module: ModuleKey | "all"
    /** Whether the address asks for the drawer to be open. */
    readonly isOpen: boolean
    /** The idea the drawer was opened from, or null. */
    readonly preset: AddPreset | null
}

/**
 * The connected way in for documents: the drop zone with its ways in (a link, a written note, Google Drive) and the drawer that
 * opens through the address, uploads files and queues links and notes.
 */
export const KnowledgeAdd = (props: KnowledgeAddProps) => {
    const { add, open, view } = useAddDocumentsView(props)
    const { note, options, queue } = add
    const progress = useAddProgress(add.queuedDocs)
    return (
        <KnowledgeAddBase
            props={{ ...view, progress }}
            on={{
                dropFiles: (files) => {
                    queue.addFiles(files)
                    open("files")
                },
                close: add.close,
                setMode: add.pickMode,
                addFiles: queue.addFiles,
                setLink: add.linkRows.setValue,
                checkLink: add.linkRows.validate,
                addLink: add.linkRows.add,
                removeLink: add.linkRows.remove,
                removeItem: queue.removeItem,
                retryItem: add.retryItem,
                dismissStopped: queue.dismissInterrupted,
                setTitle: note.setTitle,
                setContent: note.setContent,
                setPair: note.setPair,
                addPair: note.addPair,
                removePair: note.removePair,
                setTopic: options.setTopic,
                setTags: options.setTags,
                setModule: options.pickModule,
                setVisibility: (value) => options.setVisibility(value === "public" ? "public" : "internal"),
                submit: add.submit,
            }}
        />
    )
}
