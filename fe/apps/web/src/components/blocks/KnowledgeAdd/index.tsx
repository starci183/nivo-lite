"use client"

import { KnowledgeAddBase, type KnowledgeAddProps } from "./component"
import { useAddDocumentsView } from "@/hooks/knowledge"

/**
 * The connected way in for documents: the drop zone with its ways in (a link, a written note, Google Drive) and the drawer that
 * opens through the address, uploads files and queues links and notes.
 */
export const KnowledgeAdd = (props: KnowledgeAddProps) => {
    const { add, open, view } = useAddDocumentsView(props)
    const { note, options, queue } = add
    return (
        <KnowledgeAddBase
            props={view}
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
