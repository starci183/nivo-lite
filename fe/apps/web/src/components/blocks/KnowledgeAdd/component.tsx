import { Alert, Button, EmptyNotice, Meter, Tabs, SurfaceCard, Text, Stack, Cluster } from "@starci/grammar/common"
import type { BatchBytesView, LinkRowView, QueueRowView, StoppedUploadsView } from "@/modules/types"
import { AddFilesPanel, knowledgeUploadRowsOf } from "@/components/composites/AddFilesPanel"

import { AddNotePanel, type PairView } from "@/components/composites/AddNotePanel"

import { FormNotice } from "@/components/composites/FormNotice"
import { AddOptionsPanel, type ChoiceView } from "@/components/composites/AddOptionsPanel"

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
    readonly topic: string
    readonly tags: string
    readonly module: string
    readonly moduleOptions: ReadonlyArray<ChoiceView>
}

/** The raw document allowance as the meter draws it. */
interface UsageView {
    readonly label: string
    readonly value: number
    readonly max: number
    readonly valueLabel: string
    readonly tone: "affirmative" | "cautionary" | "negative"
}

/** The Google Drive way in: the button for where the grant stands, and its words. */
interface DriveView {
    readonly label: string | undefined
    readonly note?: string | undefined
    readonly trouble?: string | undefined
}

/** What follows a finished batch: how many questions NIVO now has for the owner, and the way to them. */
interface SummaryView {
    readonly title: string
    readonly actionLabel: string
}

/** Copy, values and state the connected drawer supplies. */
export interface KnowledgeAddBaseProps {
    readonly props: {
        /** Set when the member may only read: the words replace the form. */
        readonly readOnlyNote?: string | undefined
        readonly drive: DriveView
        readonly title: string
        readonly submitLabel: string
        readonly emptyQueueLabel: string
        readonly failTitle: string
        readonly isBusy: boolean
        readonly modeLabel: string
        readonly modeOptions: ReadonlyArray<ChoiceView>
        readonly mode: string
        readonly files: FilesView
        readonly note: NoteView
        /** Says that what is added here is internal: customers and the chatbot cannot read it. */
        readonly internalNote: string
        readonly summary: SummaryView | null
        /** How much of the raw document allowance is used; nothing is drawn for it while undefined. */
        readonly usage: UsageView | undefined
        readonly options: OptionsView
        readonly notice?: string | undefined
        readonly error?: string | undefined
    }
    readonly on: {
        readonly connectDrive: () => void
        readonly seeQuestions: () => void
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
        readonly submit: () => void
    }
}

/** The card owns the upload queue as its final collection, never as a second raised surface. */
export const KnowledgeAddBase = (props: KnowledgeAddBaseProps) =>
    props.props.readOnlyNote !== undefined ? (
        <Text size="sm" tone="muted">
            {props.props.readOnlyNote}
        </Text>
    ) : (
        <SurfaceCard
            kind="bands"
            label={props.props.title}
            headingLevel={2}
            bands={
                props.props.mode === "files" && props.props.files.queue.length > 0
                    ? [
                          { kind: "body", children: <AddBody {...props} /> },
                          {
                              kind: "list",
                              items: knowledgeUploadRowsOf({
                                  queue: props.props.files.queue,
                                  removeLabel: props.props.files.removeLabel,
                                  onRetryItem: props.on.retryItem,
                                  onRemoveItem: props.on.removeItem,
                              }),
                              empty: <EmptyNotice message={props.props.emptyQueueLabel} />,
                          },
                      ]
                    : [{ kind: "body", children: <AddBody {...props} /> }]
            }
        />
    )

/** Upload, copy and form controls remain the body of the same subject. */
const AddBody = (props: KnowledgeAddBaseProps) => (
    <Stack gap="row">
        <FormNotice failTitle={props.props.failTitle} error={props.props.error} done={props.props.notice} />
        <Tabs
            label={props.props.modeLabel}
            selectedKey={props.props.mode}
            panelId="knowledge-add-mode"
            items={props.props.modeOptions.map((one) => ({
                id: one.id,
                label: one.label,
                isDisabled: props.props.isBusy,
            }))}
            onSelect={props.on.setMode}
        />
        <div id="knowledge-add-mode" role="tabpanel">
            {props.props.mode === "files" ? (
                <FilesPart {...props} />
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
        </div>
        <Text size="sm" tone="muted">
            {props.props.internalNote}
        </Text>
        <AddOptionsPanel
            {...props.props.options}
            isBusy={props.props.isBusy}
            onTopic={props.on.setTopic}
            onTags={props.on.setTags}
            onModule={props.on.setModule}
        />
        <div>
            <Button intent="commit" isPending={props.props.isBusy} onPress={props.on.submit}>
                {props.props.submitLabel}
            </Button>
        </div>
        {props.props.usage === undefined ? null : (
            <Meter
                label={props.props.usage.label}
                value={props.props.usage.value}
                minValue={0}
                maxValue={props.props.usage.max}
                valueLabel={props.props.usage.valueLabel}
                tone={props.props.usage.tone}
            />
        )}
        {props.props.summary === null ? null : (
            <Alert
                tone="informative"
                title={props.props.summary.title}
                action={{ label: props.props.summary.actionLabel, onAction: props.on.seeQuestions }}
            />
        )}
    </Stack>
)

/** The files and links a person adds, with the Google Drive way in under them. */
const FilesPart = (props: KnowledgeAddBaseProps) => (
    <>
        <AddFilesPanel
            {...props.props.files}
            isBusy={props.props.isBusy}
            onFiles={props.on.addFiles}
            onLink={props.on.setLink}
            onCheckLink={props.on.checkLink}
            onAddLink={props.on.addLink}
            onRemoveLink={props.on.removeLink}
            onDismissStopped={props.on.dismissStopped}
        />
        <Cluster gap="inline" align="center">
            {props.props.drive.label === undefined ? null : (
                <Button intent="neutral" isDisabled={props.props.isBusy} onPress={props.on.connectDrive}>
                    {props.props.drive.label}
                </Button>
            )}
            {props.props.drive.note === undefined ? null : (
                <Text size="sm" tone="muted">
                    {props.props.drive.note}
                </Text>
            )}
            {props.props.drive.trouble === undefined ? null : (
                <Alert tone="negative" title={props.props.drive.trouble} />
            )}
        </Cluster>
    </>
)
