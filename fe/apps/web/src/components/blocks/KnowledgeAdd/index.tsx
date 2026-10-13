"use client"

import { useTranslations } from "next-intl"
import { AGENT_MODULES, uploadDocument, useAddDocuments } from "@/hooks/knowledge"
import type { AddMode, AddPreset, InstanceOption, QueueActions, QueueItem } from "@/hooks/knowledge"
import { writeKnowledgeSource } from "@/modules/db/knowledge/write-source"
import { navigation } from "@/modules/i18n"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import { KnowledgeAddBase } from "./component"
import type { KnowledgeAddBaseProps } from "./component"

/** Props for the connected add documents drawer. */
interface KnowledgeAddProps {
    readonly workspaceId: string
    /** The agent instances a document may be kept for. */
    readonly instances: ReadonlyArray<InstanceOption>
    /** Whether the address asks for the drawer to be open. */
    readonly isOpen: boolean
    /** The idea the drawer was opened from, or null. */
    readonly preset: AddPreset | null
}

const MODES: ReadonlyArray<AddMode> = ["files", "write", "faq"]

const MODE_KEYS: Readonly<Record<AddMode, "tabFiles" | "tabWrite" | "tabFaq">> = {
    files: "tabFiles",
    write: "tabWrite",
    faq: "tabFaq",
}

const STATUS_TONE: Readonly<Record<QueueItem["status"], "neutral" | "warning" | "success" | "danger">> = {
    waiting: "neutral",
    uploading: "warning",
    queued: "success",
    failed: "danger",
}

const DOCUMENT_STATUS_KEYS: Readonly<
    Record<QueueItem["status"], "itemWaiting" | "itemUploading" | "itemQueued" | "itemFailed">
> = {
    waiting: "itemWaiting",
    uploading: "itemUploading",
    queued: "itemQueued",
    failed: "itemFailed",
}

/** Sends bytes to the private bucket and hands a document to the job queue, as the member who is adding. */
const actionsFor = (workspaceId: string): QueueActions => ({
    upload: (file) => uploadDocument(workspaceId, file),
    enqueue: async (item) => (await writeKnowledgeSource({ workspaceId, ...item })).kind === "ok",
})

/** The connected add documents drawer: opens and closes through the address, uploads files and queues links and notes. */
export const KnowledgeAdd = (props: KnowledgeAddProps) => {
    const t = useTranslations("knowledge")
    const router = navigation.useRouter()
    const add = useAddDocuments({
        actions: actionsFor(props.workspaceId),
        instances: props.instances,
        preset: props.preset,
        faqLabels: { question: t("faqQuestionPrefix"), answer: t("faqAnswerPrefix") },
        onAdded: () => router.refresh(),
        onClose: () => router.replace(KNOWLEDGE_ROUTES.library),
    })
    const { note, options, queue } = add
    const isNoteMode = add.mode !== "files"
    const missingTitle = isNoteMode && note.tried && note.title.trim() === ""
    const missingBody = isNoteMode && note.tried && add.noteBody.trim() === ""
    const queueRow = (item: QueueItem) => ({
        id: item.id,
        name: item.name,
        detail: [t(item.kind === "link" ? "itemLink" : "itemFile"), item.origin ?? ""].filter(Boolean).join(" · "),
        statusLabel: t(DOCUMENT_STATUS_KEYS[item.status]),
        statusTone: STATUS_TONE[item.status],
        error: item.error === undefined ? undefined : t(item.error),
        canRemove: item.status !== "uploading" && !add.isBusy,
    })
    const submitLabel = (): string => {
        if (add.isDone) return t("done")
        if (isNoteMode) return t("save")
        if (add.pendingCount === 0) return t("submitEmpty")
        return t(add.hasFailed ? "submitRetry" : "submitFiles", { count: add.pendingCount })
    }
    const filesNote = (): string | undefined => {
        if (queue.isReading) return t("zipReading")
        return note.tried && !isNoteMode && add.pendingCount === 0 ? t("hintNoDocs") : undefined
    }
    const view: KnowledgeAddBaseProps["props"] = {
        buttonLabel: t("addButton"),
        title: t("addTitle"),
        description: t("drawerHint"),
        closeLabel: t("addCancel"),
        submitLabel: submitLabel(),
        cancelLabel: t("addCancel"),
        failTitle: t("saveFailed"),
        isOpen: props.isOpen,
        isBusy: add.isBusy,
        modeLabel: t("addTitle"),
        modeOptions: MODES.map((mode) => ({ id: mode, label: t(MODE_KEYS[mode]) })),
        mode: add.mode,
        files: {
            dropPrompt: t("filesDrop"),
            dropHint: t("filesHint"),
            linksLabel: t("linksField"),
            linksHint: t("linksHint"),
            linkPlaceholder: t("linkPlaceholder"),
            linkRemoveLabel: t("linkRemoveLabel"),
            addLinkLabel: t("linkAdd"),
            queueTitle: t("queueTitle"),
            removeLabel: t("itemRemove"),
            links: add.linkRows.rows.map((row, index) => {
                const problem = add.linkRows.errors[row.id]
                return {
                    id: row.id,
                    label: t("linkRowN", { n: index + 1 }),
                    value: row.value,
                    error: problem === undefined ? undefined : t(problem),
                }
            }),
            queue: queue.items.map(queueRow),
            note: filesNote(),
        },
        note: {
            titleLabel: t("fieldTitle"),
            titleHint: t("fieldTitleHint"),
            contentLabel: t("fieldContent"),
            contentHint: t("fieldContentHint"),
            questionLabel: t("faqQuestion"),
            answerLabel: t("faqAnswer"),
            addLabel: t("faqAddRow"),
            removeLabel: t("faqRemoveRow"),
            title: note.title,
            content: note.content,
            pairs: add.mode === "faq" ? note.pairs : undefined,
            titleError: missingTitle ? t("hintNeedTitle") : undefined,
            contentError: missingBody ? t("hintNeedContent") : undefined,
        },
        options: {
            title: t("optionsTitle"),
            topicLabel: t("fieldTopic"),
            topicHint: t("fieldTopicHint"),
            tagsLabel: t("fieldTags"),
            tagsHint: t("fieldTagsHint"),
            moduleLabel: t("fieldModule"),
            visibilityLabel: t("fieldVisibility"),
            topic: options.topic,
            tags: options.tags,
            module: options.moduleValue,
            visibility: options.visibility,
            moduleOptions: [
                { id: "all", label: t("moduleAll") },
                ...AGENT_MODULES.map((key) => ({ id: key, label: t(`module_${key}`) })),
                ...props.instances.map((one) => ({ id: `inst:${one.id}`, label: one.label })),
            ],
            visibilityOptions: [
                { id: "internal", label: t("visInternal") },
                { id: "public", label: t("visPublic") },
            ],
        },
        notice: add.queuedCount > 0 ? t("batchQueued", { count: add.queuedCount }) : undefined,
        error: add.failure === null ? undefined : t(add.failure),
    }
    return (
        <KnowledgeAddBase
            props={view}
            on={{
                open: () => router.push(`${KNOWLEDGE_ROUTES.library}?add=files`),
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
