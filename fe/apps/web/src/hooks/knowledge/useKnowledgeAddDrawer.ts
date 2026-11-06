"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import { useBrainTodoCount } from "@/hooks/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import { isDocumentActive } from "@/modules/documents"
import type { KnowledgeAddDrawerView } from "@/modules/types"
import type { AddPreset } from "@/hooks/knowledgeAddTypes"
import type { ModuleKey } from "@/modules/catalog"
import { useAddDocumentsView } from "./useAddDocumentsView"
import { useKnowledgeSources } from "./useKnowledgeSources"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the drawer needs to know about where it was opened from. */
interface KnowledgeAddDrawerInput {
    readonly isOpen: boolean
    /** The words shown instead of the form to members who may only read. */
    readonly readOnlyNote: string
    /** The agent the list is filtered to; the drawer returns to it when it is done. */
    readonly module: ModuleKey | "all"
    /** The idea the drawer was opened from, or null. */
    readonly preset: AddPreset | null
    /** Changes with what the drawer was opened from, so its form starts again for each. */
    readonly presetKey: string
}

/**
 * The drawer that adds documents: files and links, a written note or questions with answers. Documents added here are internal; the part
 * of the Second Brain decides who reads. Once every document of the batch has been read, one line says how many questions NIVO now has.
 */
export const useKnowledgeAddDrawer = (input: KnowledgeAddDrawerInput): KnowledgeAddDrawerView => {
    const t = useTranslations("knowledge")
    const tp = useTranslations("pane")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const { add, view } = useAddDocumentsView(input)
    const { sources } = useKnowledgeSources()
    const todo = useBrainTodoCount()
    const { note, options, queue } = add
    const batch = add.queuedDocs.map((doc) => sources?.find((one) => one.id === doc.id))
    const isRead = batch.length > 0 && batch.every((one) => one !== undefined && !isDocumentActive(one.status))
    const drive = view.zone.ways.find((way) => way.id === "drive")
    const lastKey = useRef(input.presetKey)
    useEffect(() => {
        if (lastKey.current === input.presetKey) return
        lastKey.current = input.presetKey
        options.setTopic(input.preset?.topic ?? "")
        options.setTags(input.preset?.tags ?? "")
        add.pickMode(input.preset === null ? "files" : (input.preset.mode ?? "write"))
    }, [add, options, input.preset, input.presetKey])
    const moduleLabel = view.options.moduleOptions.find((one) => one.id === view.options.module)?.label ?? ""
    return {
        props: {
            ...view,
            isOpen: input.isOpen,
            closeLabel: tp("closeAside"),
            cancelLabel: t("addCancel"),
            emptyQueueLabel: t("hintNoDocs"),
            drive: { label: drive?.label, note: view.zone.driveNote, trouble: view.zone.driveFailure },
            options: {
                ...view.options,
                summary: `${view.options.topic.trim() === "" ? t("addNoTopic") : view.options.topic.trim()} · ${moduleLabel}`,
            },
            summary:
                isRead && todo > 0 ? { title: t("summaryAsk", { count: todo }), actionLabel: t("summarySee") } : null,
        },
        on: {
            close: add.close,
            connectDrive: () => drive?.onPress(),
            seeQuestions: () => router.push(workspaceHref(workspaceId, brainTabHref("todo"))),
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
            submit: add.submit,
        },
    }
}
