import type { useTranslations } from "next-intl"
import type { ModuleKey } from "@/modules/catalog"
import { AGENT_MODULES, canRetry } from "@/modules/documents"
import type { QueueItem } from "@/modules/documents"
import type { AddMode, useAddDocuments } from "./useAddDocuments"
import type { useAddInstances } from "./useAddInstances"
import type { AddPreset } from "./useBatchOptions"

type Translate = ReturnType<typeof useTranslations<"knowledge">>

/** Badge tones used by the document upload queue. */
type QueueStatusTone = "success" | "danger" | "warning" | "neutral"

/** What the add documents drawer is told by the page. */
export interface AddDocumentsViewInput {
    /** The words shown instead of the drop zone to members who may only read. */
    readonly readOnlyNote: string
    /** The agent the list of documents is filtered to; the drawer returns to it when it closes. */
    readonly module: ModuleKey | "all"
    /** Whether the address asks for the drawer to be open. */
    readonly isOpen: boolean
    /** The idea the drawer was opened from, or null. */
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

/** Feedback tone for each queued document status. */
const STATUS_TONE: Readonly<Record<QueueItem["status"], QueueStatusTone>> = {
    waiting: "neutral",
    uploading: "warning",
    queued: "success",
    failed: "danger",
}

/** Translation keys for queued document statuses. */
const QUEUE_STATUS_KEYS: Readonly<
    Record<QueueItem["status"], "itemWaiting" | "itemUploading" | "itemQueued" | "itemFailed">
> = {
    waiting: "itemWaiting",
    uploading: "itemUploading",
    queued: "itemQueued",
    failed: "itemFailed",
}

/** Megabytes with the reader's decimal mark. */
const megabytesOf = (locale: string, bytes: number): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / BYTES_PER_MB)

/** The bytes of a file that reached storage: the whole size once it is queued, the fraction while it travels, 0 before. */
const sentBytesOf = (item: QueueItem): number => {
    const size = item.size ?? 0
    return item.status === "queued" ? size : Math.round(size * (item.uploaded ?? 0))
}

/** What a file row says about its bytes: how far it got while it travels, or where it stopped; empty for a link or a file not sent yet. */
const bytesDetailOf = (t: Translate, locale: string, item: QueueItem): string => {
    const size = item.size ?? 0
    if (item.file === undefined || size === 0 || item.uploaded === undefined) return ""
    const sent = megabytesOf(locale, sentBytesOf(item))
    const all = megabytesOf(locale, size)
    const percent = Math.round((sentBytesOf(item) / size) * 100)
    return t(item.status === "failed" ? "uploadStoppedAt" : "uploadBytes", { sent, size: all, percent })
}

/** The status badge of a row: a file whose bytes all arrived is being put in the queue. */
const statusLabelOf = (t: Translate, item: QueueItem): string =>
    item.status === "uploading" && item.uploaded === 1 ? t("itemEnqueuing") : t(QUEUE_STATUS_KEYS[item.status])

/** The row of the queue for one file or link, already worded. */
const queueRowOf = (t: Translate, locale: string, add: ReturnType<typeof useAddDocuments>, item: QueueItem) => ({
    id: item.id,
    name: item.name,
    detail: [t(item.kind === "link" ? "itemLink" : "itemFile"), item.origin ?? "", bytesDetailOf(t, locale, item)]
        .filter(Boolean)
        .join(" · "),
    statusLabel: statusLabelOf(t, item),
    statusTone: STATUS_TONE[item.status],
    error: item.error === undefined ? undefined : t(item.error),
    canRemove: item.status !== "uploading" && !add.isBusy,
    retryLabel: item.status === "failed" && canRetry(item) && !add.isBusy ? t("itemRetry") : undefined,
})

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

/** The bytes of the whole batch while it travels, or undefined when no file is on its way. */
const batchViewOf = (t: Translate, locale: string, items: ReadonlyArray<QueueItem>) => {
    const files = items.filter((item) => item.file !== undefined && (item.size ?? 0) > 0)
    if (!files.some((item) => item.status === "uploading")) return undefined
    const total = files.reduce((sum, item) => sum + (item.size ?? 0), 0)
    const sent = files.reduce((sum, item) => sum + sentBytesOf(item), 0)
    const percent = Math.round((sent / total) * 100)
    return {
        label: t("batchBytesLabel"),
        value: percent,
        valueText: t("batchBytes", {
            count: files.length,
            sent: megabytesOf(locale, sent),
            total: megabytesOf(locale, total),
            percent,
        }),
    }
}

/** The notice that says the uploads of an earlier page stopped when it reloaded. */
const stoppedViewOf = (t: Translate, names: ReadonlyArray<string>) =>
    names.length === 0 ? undefined : { text: t("uploadStopped", { names: names.join(", ") }), dismissLabel: t("uploadStoppedDismiss"), pickLabel: t("uploadStoppedPick") }

/** Builds the files and links section of the drawer. */
const buildDocumentFilesView = (t: Translate, locale: string, add: ReturnType<typeof useAddDocuments>) =>
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
        queue: add.queue.items.map((item) => queueRowOf(t, locale, add, item)),
        batch: batchViewOf(t, locale, add.queue.items),
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
    }) as const

const BYTES_PER_MB = 1024 * 1024

/** How the meter judges a share of the allowance: nearly full is cautionary, full is negative. */
const usageToneOf = (share: number): UsageView["tone"] => {
    if (share >= 1) return "negative"
    return share >= 0.9 ? "cautionary" : "affirmative"
}

/** The workspace's raw document allowance as the meter draws it. */
export interface UsageView {
    readonly label: string
    readonly value: number
    readonly max: number
    readonly valueLabel: string
    readonly tone: "affirmative" | "cautionary" | "negative"
}

/** The meter of the raw document allowance, in megabytes with one decimal in the viewer's language; nothing until the usage is known. */
export const usageViewOf = (
    t: Translate,
    locale: string,
    usage: { readonly usedBytes: number; readonly limitBytes: number } | undefined,
): UsageView | undefined => {
    if (usage === undefined) return undefined
    const megabytes = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
    return {
        label: t("usageLabel"),
        value: usage.usedBytes,
        max: usage.limitBytes,
        valueLabel: t("usageValue", {
            used: megabytes.format(usage.usedBytes / BYTES_PER_MB),
            limit: megabytes.format(usage.limitBytes / BYTES_PER_MB),
        }),
        tone: usageToneOf(usage.usedBytes / usage.limitBytes),
    }
}

/** What the view of the drawer is built from. */
interface ViewContext {
    readonly t: Translate
    readonly locale: string
    readonly props: AddDocumentsViewInput
    readonly add: ReturnType<typeof useAddDocuments>
    readonly canWrite: boolean
    readonly instances: ReturnType<typeof useAddInstances>["instances"]
    readonly zone: ZoneView
    readonly usage: UsageView | undefined
}

/** Builds everything the connected drawer and its drop zone draw. */
export const buildAddDocumentsView = ({ t, locale, props, add, canWrite, instances, zone, usage }: ViewContext) =>
    ({
        zone,
        usage,
        title: t("addTitle"),
        description: t("drawerHint"),
        closeLabel: t("addCancel"),
        submitLabel: submitLabelOf(t, add),
        cancelLabel: t("addCancel"),
        failTitle: t("saveFailed"),
        readOnlyNote: canWrite ? undefined : props.readOnlyNote,
        isOpen: props.isOpen,
        isBusy: add.isBusy,
        modeLabel: t("addTitle"),
        modeOptions: MODES.map((mode) => ({ id: mode, label: t(MODE_KEYS[mode]) })),
        mode: add.mode,
        files: buildDocumentFilesView(t, locale, add),
        note: buildNoteView(t, add),
        options: buildOptionsView(t, add.options, instances),
        notice: add.queuedCount > 0 ? t("batchQueued", { count: add.queuedCount }) : undefined,
        error: add.failure === null ? undefined : t(add.failure),
    }) as const

/** The drop zone the page shows in place of an add button: its words, its ways in and where the Drive grant stands. */
export interface ZoneView {
    readonly label: string
    readonly prompt: string
    readonly hint: string
    readonly ways: ReadonlyArray<{ readonly id: string; readonly label: string; readonly onPress: () => void }>
    readonly driveNote?: string | undefined
    readonly driveFailure?: string | undefined
}
