import type { useFormatter, useTranslations } from "next-intl"
import type { ModuleKey } from "@/modules/catalog"
import { AGENT_MODULES, batchBytesOf, queueRowOf } from "@/modules/documents"
import type { UsageView } from "@/modules/documents"
import type { AddMode, useAddDocuments } from "./useAddDocuments"
import type { useAddInstances } from "./useAddInstances"
import type { AddPreset } from "./useBatchOptions"
import type { FaqEntry } from "./useNoteDraft"

type Translate = ReturnType<typeof useTranslations<"knowledge">>

/** What the add documents drawer is told by the page. */
export interface AddDocumentsViewInput {
    /** The words shown instead of the drop zone to members who may only read. */
    readonly readOnlyNote: string
    /** The agent the list of documents is filtered to; the drawer returns to it when it closes. */
    readonly module: ModuleKey | "all"
    /** The idea the form was opened from, or null. */
    readonly preset: AddPreset | null
}

/** Available document entry modes. */
const MODES: ReadonlyArray<AddMode> = ["files", "write", "faq"]

/** Translation keys for the entry-mode tabs. */
const MODE_KEYS: Readonly<Record<AddMode, "tabFiles" | "tabWrite" | "tabFaq">> = {
    files: "tabFiles",
    write: "tabWrite",
    faq: "tabFaq",
}

/** The label of the main action of the drawer. */
const submitLabelOf = (t: Translate, add: ReturnType<typeof useAddDocuments>): string => {
    if (add.isDone) return t("done")
    if (add.mode !== "files") return t("save")
    if (add.pendingCount === 0) return t("submitEmpty")
    return t(add.hasFailed ? "submitRetry" : "submitFiles", { count: add.pendingCount })
}

/** The line under the files and links that says what is missing or what is happening. */
const filesNoteOf = (t: Translate, add: ReturnType<typeof useAddDocuments>): string | undefined => {
    if (add.queue.isReading) return t("zipReading")
    return add.note.tried && add.mode === "files" && add.pendingCount === 0 ? t("hintNoDocs") : undefined
}

/** The notice that says the uploads of an earlier page stopped when it reloaded. */
const stoppedViewOf = (t: Translate, names: ReadonlyArray<string>) =>
    names.length === 0
        ? undefined
        : {
              text: t("uploadStopped", { names: names.join(", ") }),
              dismissLabel: t("uploadStoppedDismiss"),
              pickLabel: t("uploadStoppedPick"),
          }

/** Builds the files and links section of the drawer. */
const buildDocumentFilesView = (
    t: Translate,
    formatter: ReturnType<typeof useFormatter>,
    add: ReturnType<typeof useAddDocuments>,
) =>
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

/** Builds the note section of the drawer (a written note, or a list of questions with answers). */
const buildNoteView = (t: Translate, add: ReturnType<typeof useAddDocuments>) => {
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

/** Builds the options section of the drawer. */
const buildOptionsView = (
    t: Translate,
    options: ReturnType<typeof useAddDocuments>["options"],
    instances: ReturnType<typeof useAddInstances>["instances"],
) =>
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

/** What the view of the drawer is built from. */
interface ViewContext {
    readonly t: Translate
    readonly formatter: ReturnType<typeof useFormatter>
    readonly props: AddDocumentsViewInput
    readonly add: ReturnType<typeof useAddDocuments>
    readonly canWrite: boolean
    readonly instances: ReturnType<typeof useAddInstances>["instances"]
    readonly zone: ZoneView
    readonly usage: UsageView | undefined
}

/** What `buildAddDocumentsView` returns. */
export interface BuildAddDocumentsViewResult {
    readonly zone: ZoneView
    readonly usage: UsageView | undefined
    readonly title: string
    readonly submitLabel: string
    readonly failTitle: string
    readonly readOnlyNote: string | undefined
    readonly isBusy: boolean
    readonly modeLabel: string
    readonly modeOptions: {
        id: AddMode
        label: string
    }[]
    readonly mode: AddMode
    readonly files: {
        readonly dropPrompt: string
        readonly dropHint: string
        readonly linksLabel: string
        readonly linksHint: string
        readonly linkPlaceholder: string
        readonly linkRemoveLabel: string
        readonly addLinkLabel: string
        readonly queueTitle: string
        readonly removeLabel: string
        readonly links: {
            id: string
            label: string
            value: string
            error: string | undefined
        }[]
        readonly queue: {
            id: string
            name: string
            detail: string
            statusLabel: string
            statusTone: "success" | "neutral" | "danger" | "warning"
            error: string | undefined
            canRemove: boolean
            retryLabel: string | undefined
        }[]
        readonly batch:
            | {
                  label: string
                  value: number
                  valueText: string
              }
            | undefined
        readonly stopped:
            | {
                  text: string
                  dismissLabel: string
                  pickLabel: string
              }
            | undefined
        readonly note: string | undefined
    }
    readonly note: {
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
    readonly internalNote: string
    readonly options: {
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
            {
                readonly id: "all"
                readonly label: string
            },
            ...(
                | {
                      id:
                          | "content"
                          | "chatbot"
                          | "lead_gen"
                          | "sales"
                          | "accounting"
                          | "shifts"
                          | "booking"
                          | "inventory"
                          | "loyalty"
                          | "video"
                          | "hiring"
                      label: string
                  }
                | {
                      id: string
                      label: string
                  }
            )[],
        ]
    }
    readonly notice: string | undefined
    readonly error: string | undefined
}

/** Builds everything the connected drawer and its drop zone draw. */
export const buildAddDocumentsView = ({
    t,
    formatter,
    props,
    add,
    canWrite,
    instances,
    zone,
    usage,
}: ViewContext): BuildAddDocumentsViewResult =>
    ({
        zone,
        usage,
        title: t("addTitle"),
        submitLabel: submitLabelOf(t, add),
        failTitle: t("saveFailed"),
        readOnlyNote: canWrite ? undefined : props.readOnlyNote,
        isBusy: add.isBusy,
        modeLabel: t("addTitle"),
        modeOptions: MODES.map((mode) => ({ id: mode, label: t(MODE_KEYS[mode]) })),
        mode: add.mode,
        files: buildDocumentFilesView(t, formatter, add),
        note: buildNoteView(t, add),
        internalNote: t("addInternalNote"),
        options: buildOptionsView(t, add.options, instances),
        notice: add.queuedCount > 0 ? t("batchQueued", { count: add.queuedCount }) : undefined,
        error: add.failure === null ? undefined : t(add.failure),
    }) as const

/** The Google Drive way in beside the files, and where the grant stands. */
export interface ZoneView {
    readonly ways: ReadonlyArray<{ readonly id: string; readonly label: string; readonly onPress: () => void }>
    readonly driveNote?: string | undefined
    readonly driveFailure?: string | undefined
}
