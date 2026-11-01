import type { useFormatter, useTranslations } from "next-intl"
import type { ModuleKey } from "@/modules/catalog"
import { AGENT_MODULES, batchBytesOf, queueRowOf, visibilityNoteOf } from "@/modules/documents"
import type { UsageView } from "@/modules/documents"
import type { AddMode, useAddDocuments } from "./useAddDocuments"
import type { useAddInstances } from "./useAddInstances"
import type { AddPreset } from "./useBatchOptions"

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

/** Builds the choice of who may read what is added. Nothing is chosen until the owner chooses. */
const buildVisibilityView = (t: Translate, options: ReturnType<typeof useAddDocuments>["options"]) =>
    ({
        label: t("fieldVisibility"),
        consequence: visibilityNoteOf(t, options.visibility, options.suggested),
        value: options.visibility,
        options: [
            { id: "public", label: t("visPublic") },
            { id: "internal", label: t("visInternal") },
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

/** Builds everything the connected drawer and its drop zone draw. */
export const buildAddDocumentsView = ({ t, formatter, props, add, canWrite, instances, zone, usage }: ViewContext) =>
    ({
        zone,
        usage,
        title: t("addTitle"),
        submitLabel: submitLabelOf(t, add),
        submitBlocked: add.isDone || add.options.visibility !== null ? "" : t("visNeeded"),
        failTitle: t("saveFailed"),
        readOnlyNote: canWrite ? undefined : props.readOnlyNote,
        isBusy: add.isBusy,
        modeLabel: t("addTitle"),
        modeOptions: MODES.map((mode) => ({ id: mode, label: t(MODE_KEYS[mode]) })),
        mode: add.mode,
        files: buildDocumentFilesView(t, formatter, add),
        note: buildNoteView(t, add),
        visibility: buildVisibilityView(t, add.options),
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
