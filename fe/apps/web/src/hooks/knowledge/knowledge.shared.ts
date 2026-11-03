import type { useFormatter, useTranslations } from "next-intl"
import type { ModuleKey } from "@/modules/catalog"
import type { UsageView } from "@/modules/documents"
import type { useAddDocuments } from "./useAddDocuments"
import {
    ADD_MODES,
    ADD_MODE_KEYS,
    buildDocumentFilesView,
    buildNoteView,
    buildOptionsView,
} from "@/hooks/knowledgeAddParts"
import type { useAddInstances } from "./useAddInstances"
import type { AddMode, AddPreset, FaqEntry } from "@/hooks/knowledgeAddTypes"

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

/** The label of the main action of the drawer. */
const submitLabelOf = (t: Translate, add: ReturnType<typeof useAddDocuments>): string => {
    if (add.isDone) return t("done")
    if (add.mode !== "files") return t("save")
    if (add.pendingCount === 0) return t("submitEmpty")
    return t(add.hasFailed ? "submitRetry" : "submitFiles", { count: add.pendingCount })
}

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
        modeOptions: ADD_MODES.map((mode) => ({ id: mode, label: t(ADD_MODE_KEYS[mode]) })),
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
