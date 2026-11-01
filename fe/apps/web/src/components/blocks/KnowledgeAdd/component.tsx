import { Drawer, SegmentedControl, Text } from "@starci/grammar/common"
import type { BatchBytesView, LinkRowView, QueueRowView, StoppedUploadsView } from "@/modules/types"
import { AddFilesPanel } from "@/components/composites/AddFilesPanel"

import { AddNotePanel, type PairView } from "@/components/composites/AddNotePanel"

import { DocumentDropZone, type DropWayView } from "@/components/composites/DocumentDropZone"
import { DrawerFooter } from "@/components/composites/DrawerFooter"
import { FormNotice } from "@/components/composites/FormNotice"
import { AddOptionsPanel, type ChoiceView } from "@/components/composites/AddOptionsPanel"

import { DRAWER_BODY_CLASS_NAME } from "./classNames"

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
    readonly batch?: BatchBytesView | undefined
    readonly stopped?: StoppedUploadsView | undefined
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

/** The words and ways of the drop zone the page shows in place of an add button. */
interface ZoneView {
    readonly label: string
    readonly prompt: string
    readonly hint: string
    readonly ways: ReadonlyArray<DropWayView>
    readonly driveNote?: string | undefined
    readonly driveFailure?: string | undefined
}

/** Copy, values and state the connected drawer supplies. */
export interface KnowledgeAddBaseProps {
    readonly props: {
        /** Set when the member may only read: the words replace the drop zone and the drawer. */
        readonly readOnlyNote?: string | undefined
        readonly zone: ZoneView
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
        readonly dropFiles: (files: Array<File>) => void
        readonly close: () => void
        readonly setMode: (value: string) => void
        readonly addFiles: (files: Array<File>) => void
        readonly setLink: (id: string, value: string) => void
        readonly checkLink: (id: string) => void
        readonly addLink: () => void
        readonly removeLink: (id: string) => void
        readonly removeItem: (id: string) => void
        readonly retryItem: (id: string) => void
        readonly dismissStopped: () => void
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

/** Draws the drop zone and the drawer that adds documents: files and links, a written note, or questions with answers. */
export const KnowledgeAddBase = (props: KnowledgeAddBaseProps) =>
    props.props.readOnlyNote !== undefined ? (
        <Text size="sm" tone="muted">
            {props.props.readOnlyNote}
        </Text>
    ) : (
        <>
            <DocumentDropZone {...props.props.zone} isDisabled={props.props.isBusy} onFiles={props.on.dropFiles} />
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
                    onRetryItem={props.on.retryItem}
                    onDismissStopped={props.on.dismissStopped}
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
