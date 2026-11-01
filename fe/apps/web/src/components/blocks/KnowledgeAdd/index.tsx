"use client"

import { useTranslations } from "next-intl"
import { isDocumentActive, useAddDocumentsView, useKnowledgeSources } from "@/hooks/knowledge"
import { useBrainTodoCount } from "@/hooks/brain"
import type { AddPreset, ModuleKey } from "@/hooks/knowledge"
import { navigation } from "@/modules/i18n"
import { brainTabHref } from "@/modules/routes"
import { KnowledgeAddBase } from "./component"

/** Props for the connected add documents form. */
interface KnowledgeAddProps {
    /** The words shown instead of the form to members who may only read. */
    readonly readOnlyNote: string
    /** The agent the list of documents is filtered to; the form returns to it when it is done. */
    readonly module: ModuleKey | "all"
    /** The idea the form was opened from, or null. */
    readonly preset: AddPreset | null
}

/**
 * The connected way in for documents: files and links, a written note or questions with answers, and who may read them. The
 * owner chooses who reads before the add button works; NIVO only suggests. Once every document of the batch has been read, one
 * line says how many questions NIVO now has for the owner.
 */
export const KnowledgeAdd = (props: KnowledgeAddProps) => {
    const t = useTranslations("knowledge")
    const router = navigation.useRouter()
    const { add, view } = useAddDocumentsView(props)
    const { sources } = useKnowledgeSources()
    const todo = useBrainTodoCount()
    const { note, options, queue } = add
    const batch = add.queuedDocs.map((doc) => sources?.find((one) => one.id === doc.id))
    const isRead = batch.length > 0 && batch.every((one) => one !== undefined && !isDocumentActive(one.status))
    const drive = view.zone.ways.find((way) => way.id === "drive")
    return (
        <KnowledgeAddBase
            props={{
                ...view,
                drive: { label: drive?.label, note: view.zone.driveNote, trouble: view.zone.driveFailure },
                summary:
                    isRead && todo > 0
                        ? { title: t("summaryAsk", { count: todo }), actionLabel: t("summarySee") }
                        : null,
            }}
            on={{
                connectDrive: () => drive?.onPress(),
                seeQuestions: () => router.push(brainTabHref("todo")),
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
