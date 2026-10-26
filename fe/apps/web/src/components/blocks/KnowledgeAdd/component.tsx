import type { useTranslations } from "next-intl"
import type { useAddDocuments, useAddInstances, AddMode, AddPreset, QueueItem } from "@/hooks/knowledge"

import { Button, Drawer, SegmentedControl, Text } from "@starci/grammar/common"
import { AddFilesPanel, type LinkRowView, type QueueRowView } from "@/components/composites/AddFilesPanel"

import { AddNotePanel, type PairView } from "@/components/composites/AddNotePanel"

import { DrawerFooter } from "@/components/composites/DrawerFooter"
import { FormNotice } from "@/components/composites/FormNotice"
import { AddOptionsPanel, type ChoiceView } from "@/components/composites/AddOptionsPanel"

import { DRAWER_BODY_CLASS_NAME } from "./classNames"

/** Badge tones used by the document upload queue. */
type QueueStatusTone = "success" | "danger" | "warning" | "neutral"

/** The words and values of the files and links panel. */
interface FilesView {
    readonly dropPrompt: string
    readonly dropHint: string
    readonly linksLabel: string
    readonly linksHint: string
    readonly linkPlaceholder: string
    readonly linkRemoveLabel: string
    readonly addLinkLabel: string
    readonly queueTitle: string
    readonly removeLabel: string
    readonly links: ReadonlyArray<LinkRowView>
    readonly queue: ReadonlyArray<QueueRowView>
    readonly note?: string | undefined
}

/** The words and values of the panel that writes a note, or a list of questions when pairs are set. */
interface NoteView {
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
    readonly pairs?: ReadonlyArray<PairView> | undefined
    readonly titleError?: string | undefined
    readonly contentError?: string | undefined
}

/** The words and values of the options of the batch. */
interface OptionsView {
    readonly title: string
    readonly topicLabel: string
    readonly topicHint: string
    readonly tagsLabel: string
    readonly tagsHint: string
    readonly moduleLabel: string
    readonly visibilityLabel: string
    readonly topic: string
    readonly tags: string
    readonly module: string
    readonly visibility: string
    readonly moduleOptions: ReadonlyArray<ChoiceView>
    readonly visibilityOptions: ReadonlyArray<ChoiceView>
}

/** Copy, values and state the connected drawer supplies. */
export interface KnowledgeAddBaseProps {
    readonly props: {
        /** Set when the member may only read: the words replace the button and the drawer. */
        readonly readOnlyNote?: string | undefined
        readonly buttonLabel: string
        readonly title: string
        readonly description: string
        readonly closeLabel: string
        readonly submitLabel: string
        readonly cancelLabel: string
        readonly failTitle: string
        readonly isOpen: boolean
        readonly isBusy: boolean
        readonly modeLabel: string
        readonly modeOptions: ReadonlyArray<ChoiceView>
        readonly mode: string
        readonly files: FilesView
        readonly note: NoteView
        readonly options: OptionsView
        readonly notice?: string | undefined
        readonly error?: string | undefined
    }
    readonly on: {
        readonly open: () => void
        readonly close: () => void
        readonly setMode: (value: string) => void
        readonly addFiles: (files: Array<File>) => void
        readonly setLink: (id: string, value: string) => void
        readonly checkLink: (id: string) => void
        readonly addLink: () => void
        readonly removeLink: (id: string) => void
        readonly removeItem: (id: string) => void
        readonly setTitle: (value: string) => void
        readonly setContent: (value: string) => void
        readonly setPair: (id: string, field: "q" | "a", value: string) => void
        readonly addPair: () => void
        readonly removePair: (id: string) => void
        readonly setTopic: (value: string) => void
        readonly setTags: (value: string) => void
        readonly setModule: (value: string | null) => void
        readonly setVisibility: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the button and the drawer that adds documents: files and links, a written note, or questions with answers. */
export const KnowledgeAddBase = (props: KnowledgeAddBaseProps) =>
    props.props.readOnlyNote !== undefined ? (
        <Text size="sm" tone="muted">
            {props.props.readOnlyNote}
        </Text>
    ) : (
        <>
            <Button intent="commit" onPress={props.on.open}>
                {props.props.buttonLabel}
            </Button>
            <KnowledgeAddDrawer {...props} />
        </>
    )

/** Draws the document entry panels and footer in the open drawer. */
const KnowledgeAddDrawer = (props: KnowledgeAddBaseProps) => (
    <Drawer
        isOpen={props.props.isOpen}
        onOpenChange={(open) => {
            if (!open) props.on.close()
        }}
        title={props.props.title}
        description={props.props.description}
        closeLabel={props.props.closeLabel}
        placement="right"
        footer={
            <DrawerFooter
                cancelLabel={props.props.cancelLabel}
                submitLabel={props.props.submitLabel}
                isPending={props.props.isBusy}
                onCancel={props.on.close}
                onSubmit={props.on.submit}
            />
        }
    >
        <div className={DRAWER_BODY_CLASS_NAME}>
            <SegmentedControl
                label={props.props.modeLabel}
                isLabelHidden
                options={props.props.modeOptions.map((one) => ({ value: one.id, label: one.label }))}
                value={props.props.mode}
                isDisabled={props.props.isBusy}
                onValueChange={props.on.setMode}
            />
            {props.props.mode === "files" ? (
                <AddFilesPanel
                    {...props.props.files}
                    isBusy={props.props.isBusy}
                    onFiles={props.on.addFiles}
                    onLink={props.on.setLink}
                    onCheckLink={props.on.checkLink}
                    onAddLink={props.on.addLink}
                    onRemoveLink={props.on.removeLink}
                    onRemoveItem={props.on.removeItem}
                />
            ) : (
                <AddNotePanel
                    {...props.props.note}
                    isBusy={props.props.isBusy}
                    onTitle={props.on.setTitle}
                    onContent={props.on.setContent}
                    onPair={props.on.setPair}
                    onAddPair={props.on.addPair}
                    onRemovePair={props.on.removePair}
                />
            )}
            <AddOptionsPanel
                {...props.props.options}
                isBusy={props.props.isBusy}
                onTopic={props.on.setTopic}
                onTags={props.on.setTags}
                onModule={props.on.setModule}
                onVisibility={props.on.setVisibility}
            />
            <FormNotice failTitle={props.props.failTitle} error={props.props.error} done={props.props.notice} />
        </div>
    </Drawer>
)

/** Props for the connected add documents drawer. */
export interface KnowledgeAddProps {
    /** The words shown instead of the button to members who may only read. */
    readonly readOnlyNote: string
    /** Whether the address asks for the drawer to be open. */
    readonly isOpen: boolean
    /** The idea the drawer was opened from, or null. */
    readonly preset: AddPreset | null
}

/** Inputs needed to build the KnowledgeAddContent section. */
export interface BuildDocumentFilesViewContext {
    readonly t: ReturnType<typeof useTranslations<"knowledge">>
    readonly add: ReturnType<typeof useAddDocuments>
    readonly queue: ReturnType<typeof useAddDocuments>["queue"]
    readonly queueRow: (item: QueueItem) => {
        id: string
        name: string
        detail: string
        statusLabel: string
        statusTone: QueueStatusTone
        error: string | undefined
        canRemove: boolean
    }
    readonly filesNote: () => string | undefined
}

/** Inputs needed to build the KnowledgeAddContent section. */
export interface BuildAddDocumentsViewContext {
    readonly t: ReturnType<typeof useTranslations<"knowledge">>
    readonly submitLabel: () => string
    readonly canWrite: ReturnType<typeof useAddInstances>["canWrite"]
    readonly props: KnowledgeAddProps
    readonly add: ReturnType<typeof useAddDocuments>
    readonly queue: ReturnType<typeof useAddDocuments>["queue"]
    readonly queueRow: (item: QueueItem) => {
        id: string
        name: string
        detail: string
        statusLabel: string
        statusTone: QueueStatusTone
        error: string | undefined
        canRemove: boolean
    }
    readonly filesNote: () => string | undefined
    readonly note: ReturnType<typeof useAddDocuments>["note"]
    readonly missingTitle: boolean
    readonly missingBody: boolean
    readonly options: ReturnType<typeof useAddDocuments>["options"]
    readonly instances: ReturnType<typeof useAddInstances>["instances"]
}

/** Available document entry modes. */
export const MODES: ReadonlyArray<AddMode> = ["files", "write", "faq"]

/** Translation keys for the entry-mode tabs. */
export const MODE_KEYS: Readonly<Record<AddMode, "tabFiles" | "tabWrite" | "tabFaq">> = {
    files: "tabFiles",
    write: "tabWrite",
    faq: "tabFaq",
}

/** Feedback tone for each queued document status. */
export const STATUS_TONE: Readonly<Record<QueueItem["status"], QueueStatusTone>> = {
    waiting: "neutral",
    uploading: "warning",
    queued: "success",
    failed: "danger",
}

/** Translation keys for queued document statuses. */
export const QUEUE_STATUS_KEYS: Readonly<
    Record<QueueItem["status"], "itemWaiting" | "itemUploading" | "itemQueued" | "itemFailed">
> = {
    waiting: "itemWaiting",
    uploading: "itemUploading",
    queued: "itemQueued",
    failed: "itemFailed",
}
