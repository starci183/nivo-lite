import type { useFormatter, useTranslations } from "next-intl"
import { AGENT_MODULES, batchBytesOf, queueRowOf, type InstanceOption } from "@/modules/documents"
import type { AddDocumentsView, AddMode, BatchOptions, FaqEntry } from "@/hooks/knowledgeAddTypes"

type Translate = ReturnType<typeof useTranslations<"knowledge">>

/** Available document entry modes. */
export const ADD_MODES: ReadonlyArray<AddMode> = ["files", "write", "faq"]

/** Translation keys for the entry-mode tabs. */
export const ADD_MODE_KEYS: Readonly<Record<AddMode, "tabFiles" | "tabWrite" | "tabFaq">> = {
    files: "tabFiles",
    write: "tabWrite",
    faq: "tabFaq",
}

/** What `stoppedViewOf` returns. */
export type StoppedViewOfResult = { text: string; dismissLabel: string; pickLabel: string } | undefined

/** The notice that says the uploads of an earlier page stopped when it reloaded. */
const stoppedViewOf = (t: Translate, names: ReadonlyArray<string>): StoppedViewOfResult =>
    names.length === 0
        ? undefined
        : {
              text: t("uploadStopped", { names: names.join(", ") }),
              dismissLabel: t("uploadStoppedDismiss"),
              pickLabel: t("uploadStoppedPick"),
          }

/** What `buildDocumentFilesView` returns. */
export type BuildDocumentFilesViewResult = {
    readonly dropPrompt: string
    readonly dropHint: string
    readonly linksLabel: string
    readonly linksHint: string
    readonly linkPlaceholder: string
    readonly linkRemoveLabel: string
    readonly addLinkLabel: string
    readonly queueTitle: string
    readonly removeLabel: string
    readonly links: { id: string; label: string; value: string; error: string | undefined }[]
    readonly queue: ReturnType<typeof queueRowOf>[]
    readonly batch: ReturnType<typeof batchBytesOf>
    readonly stopped: { text: string; dismissLabel: string; pickLabel: string } | undefined
    readonly note: string | undefined
}

/** Builds the files and links section of the drawer. */
export const buildDocumentFilesView = (
    t: Translate,
    formatter: ReturnType<typeof useFormatter>,
    add: AddDocumentsView,
): BuildDocumentFilesViewResult =>
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
        queue: add.queue.items.map((item) => queueRowOf(t, formatter, add.isBusy, item)),
        batch: batchBytesOf(t, formatter, add.queue.items),
        stopped: stoppedViewOf(t, add.queue.interrupted),
        note: filesNoteOf(t, add),
    }) as const

/** What `buildNoteView` returns. */
export interface BuildNoteViewResult {
    readonly titleLabel: string
    readonly titleHint: string
    readonly contentLabel: string
    readonly contentHint: string
    readonly questionLabel: string
    readonly answerLabel: string
    readonly addLabel: string
    readonly removeLabel: string
    readonly title: string
    readonly content: string
    readonly pairs: readonly FaqEntry[] | undefined
    readonly titleError: string | undefined
    readonly contentError: string | undefined
}

/** Builds the note section of the drawer (a written note, or a list of questions with answers). */
export const buildNoteView = (t: Translate, add: AddDocumentsView): BuildNoteViewResult => {
    const { note } = add
    const isNoteMode = add.mode !== "files"
    return {
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
        titleError: isNoteMode && note.tried && note.title.trim() === "" ? t("hintNeedTitle") : undefined,
        contentError: isNoteMode && note.tried && add.noteBody.trim() === "" ? t("hintNeedContent") : undefined,
    } as const
}

/** What `buildOptionsView` returns. */
export type BuildOptionsViewResult = {
    readonly title: string
    readonly topicLabel: string
    readonly topicHint: string
    readonly tagsLabel: string
    readonly tagsHint: string
    readonly moduleLabel: string
    readonly topic: string
    readonly tags: string
    readonly module: string
    readonly moduleOptions: readonly [
        { readonly id: "all"; readonly label: string },
        ...(
            | {
                  id:
                      | "chatbot"
                      | "lead_gen"
                      | "sales"
                      | "booking"
                      | "video"
                      | "content"
                      | "hiring"
                  label: string
              }
            | { id: string; label: string }
        )[],
    ]
}

/** Builds the options section of the drawer. */
export const buildOptionsView = (
    t: Translate,
    options: BatchOptions,
    instances: ReadonlyArray<InstanceOption>,
): BuildOptionsViewResult =>
    ({
        title: t("optionsTitle"),
        topicLabel: t("fieldTopic"),
        topicHint: t("fieldTopicHint"),
        tagsLabel: t("fieldTags"),
        tagsHint: t("fieldTagsHint"),
        moduleLabel: t("fieldModule"),
        topic: options.topic,
        tags: options.tags,
        module: options.moduleValue,
        moduleOptions: [
            { id: "all", label: t("moduleAll") },
            ...AGENT_MODULES.map((key) => ({ id: key, label: t(`module_${key}`) })),
            ...instances.map((one) => ({ id: `inst:${one.id}`, label: one.label })),
        ],
    }) as const

/** The line under the files and links that says what is missing or what is happening. */
const filesNoteOf = (t: Translate, add: AddDocumentsView): string | undefined => {
    if (add.queue.isReading) return t("zipReading")
    return add.note.tried && add.mode === "files" && add.pendingCount === 0 ? t("hintNoDocs") : undefined
}
