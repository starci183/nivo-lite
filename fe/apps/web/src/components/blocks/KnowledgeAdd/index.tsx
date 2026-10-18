"use client"

import {
    MODES,
    MODE_KEYS,
    STATUS_TONE,
    QUEUE_STATUS_KEYS,
    type KnowledgeAddProps,
    type BuildDocumentFilesViewContext,
    type BuildAddDocumentsViewContext,
    KnowledgeAddBase,
    type KnowledgeAddBaseProps,
} from "./component"

import { useTranslations } from "next-intl"
import { AGENT_MODULES, useAddDocuments, useAddInstances, useQueueActions, type QueueItem } from "@/hooks/knowledge"

import { navigation } from "@/modules/i18n"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"

/**
 * The connected add documents drawer: opens and closes through the address, uploads files and queues links and notes.
 */
export const KnowledgeAdd = (props: KnowledgeAddProps) => {
    const t = useTranslations("knowledge")
    const router = navigation.useRouter()
    const actions = useQueueActions()
    const { canWrite, instances } = useAddInstances()
    const add = useAddDocuments({
        actions,
        instances,
        preset: props.preset,
        faqLabels: { question: t("faqQuestionPrefix"), answer: t("faqAnswerPrefix") },
        onAdded: () => undefined,
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
        statusLabel: t(QUEUE_STATUS_KEYS[item.status]),
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
    const view: KnowledgeAddBaseProps["props"] = buildAddDocumentsView({
        t,
        submitLabel,
        canWrite,
        props,
        add,
        queue,
        queueRow,
        filesNote,
        note,
        missingTitle,
        missingBody,
        options,
        instances,
    })
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
/** Builds the KnowledgeAddContent section from the current view. */
const buildDocumentFilesView = ({ t, add, queue, queueRow, filesNote }: BuildDocumentFilesViewContext) =>
    ({
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
    }) as const
/** Builds the KnowledgeAddContent section from the current view. */
const buildAddDocumentsView = ({
    t,
    submitLabel,
    canWrite,
    props,
    add,
    queue,
    queueRow,
    filesNote,
    note,
    missingTitle,
    missingBody,
    options,
    instances,
}: BuildAddDocumentsViewContext) =>
    ({
        buttonLabel: t("addButton"),
        title: t("addTitle"),
        description: t("drawerHint"),
        closeLabel: t("addCancel"),
        submitLabel: submitLabel(),
        cancelLabel: t("addCancel"),
        failTitle: t("saveFailed"),
        readOnlyNote: canWrite ? undefined : props.readOnlyNote,
        isOpen: props.isOpen,
        isBusy: add.isBusy,
        modeLabel: t("addTitle"),
        modeOptions: MODES.map((mode) => ({ id: mode, label: t(MODE_KEYS[mode]) })),
        mode: add.mode,
        files: buildDocumentFilesView({ t, add, queue, queueRow, filesNote }),
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
                ...instances.map((one) => ({ id: `inst:${one.id}`, label: one.label })),
            ],
            visibilityOptions: [
                { id: "internal", label: t("visInternal") },
                { id: "public", label: t("visPublic") },
            ],
        },
        notice: add.queuedCount > 0 ? t("batchQueued", { count: add.queuedCount }) : undefined,
        error: add.failure === null ? undefined : t(add.failure),
    }) as const
