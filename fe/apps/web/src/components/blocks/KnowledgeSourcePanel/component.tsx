import { AlertDialog, Badge, Button, Disclosure, Meter, Text, Cluster } from "@starci/grammar/common"
import { KnowledgeRowsSection } from "@/components/composites/KnowledgeRows"
import { KnowledgeRowsSlot } from "@/components/frames/KnowledgeRowsSlot"
import type { KnowledgeListView, KnowledgeRowView, DataSlot, SlotLabels } from "@/modules/types"
import { SlotView } from "@nivo-lite/agent-sdk/client"
/** What the head of the document says: its status, who may read it and what the owner may do. */
interface HeadView {
    readonly statusLabel: string
    readonly statusTone: "neutral" | "warning" | "success" | "danger"
    readonly visibilityLabel: string
    readonly note?: string | undefined
    /** 0-100 while a worker is on it; nothing is drawn for it while undefined. */
    readonly progress?: number | undefined
    readonly canWrite: boolean
    readonly reindexLabel: string
    readonly deleteLabel: string
    readonly deleteQuestion: string
    readonly deleteConfirm: string
    readonly cancelLabel: string
    readonly contentTitle: string
    readonly content: string
    readonly isBusy: boolean
    /** True while a worker is on the document: reading it again would start a second job on the same passages. */
    readonly isReindexDisabled: boolean
}

/** The document as its slot carries it: the heading, the head and the text. */
export interface SourceDocView {
    readonly section: KnowledgeListView["section"]
    readonly head: HeadView
}

/** A document of the same shape as a ready one: the loading tree is the ready tree. */
const SOURCE_DOC_PLACEHOLDER: SourceDocView = {
    section: { id: "knowledge-source-title", title: "-", description: "-", failTitle: "" },
    head: {
        statusLabel: "-",
        statusTone: "neutral",
        visibilityLabel: "-",
        canWrite: true,
        reindexLabel: "-",
        deleteLabel: "-",
        deleteQuestion: "-",
        deleteConfirm: "-",
        cancelLabel: "-",
        contentTitle: "-",
        content: "-",
        isBusy: false,
        isReindexDisabled: false,
    },
}

/** The list of passages and the head the connected document supplies. */
export interface KnowledgeSourcePanelBaseProps {
    readonly props: {
        readonly doc: DataSlot<SourceDocView>
        readonly docLabels: SlotLabels
        readonly passages: DataSlot<ReadonlyArray<KnowledgeRowView>>
        readonly passagesLabels: SlotLabels
        readonly passagesLabel: string
        readonly isPending: boolean
    }
    readonly on: {
        readonly reindex: () => void
        readonly remove: () => Promise<void>
        readonly retry: () => void
    }
}

/** What the head draws and calls. */
interface HeadProps {
    readonly view: HeadView
    readonly isLoading: boolean
    readonly on: KnowledgeSourcePanelBaseProps["on"]
}

/** The status and facts of the document and what the owner may do to it. */
const Head = (props: HeadProps) => (
    <>
        <Cluster gap="inline">
            <Badge tone={props.view.statusTone} isLoading={props.isLoading}>
                {props.view.statusLabel}
            </Badge>
            <Badge tone="neutral" isLoading={props.isLoading}>
                {props.view.visibilityLabel}
            </Badge>
        </Cluster>
        {props.view.progress === undefined ? null : (
            <Meter label={props.view.statusLabel} value={props.view.progress} isLabelHidden />
        )}
        {props.view.note === undefined ? null : (
            <Text size="sm" tone="muted">
                {props.view.note}
            </Text>
        )}
        {props.view.canWrite ? (
            <Cluster gap="inline">
                <Button
                    intent="neutral"
                    isLoading={props.isLoading}
                    isPending={props.view.isBusy}
                    isDisabled={props.view.isReindexDisabled}
                    onPress={props.on.reindex}
                >
                    {props.view.reindexLabel}
                </Button>
                <AlertDialog
                    title={props.view.deleteQuestion}
                    description={props.view.deleteConfirm}
                    confirmLabel={props.view.deleteLabel}
                    cancelLabel={props.view.cancelLabel}
                    onConfirm={props.on.remove}
                    isConfirmPending={props.view.isBusy}
                    trigger={
                        <Button
                            intent="destructive"
                            step="entry"
                            isLoading={props.isLoading}
                            isPending={props.view.isBusy}
                        >
                            {props.view.deleteLabel}
                        </Button>
                    }
                />
            </Cluster>
        ) : null}
    </>
)

/** Draws one document: its status and facts, what the owner may do to it, its passages as agents retrieve them and its text. */
export const KnowledgeSourcePanelBase = (props: KnowledgeSourcePanelBaseProps) => (
    <SlotView
        slot={props.props.doc}
        placeholder={SOURCE_DOC_PLACEHOLDER}
        labels={props.props.docLabels}
        onRetry={props.on.retry}
        render={(doc, isLoading) => (
            <KnowledgeRowsSection
                section={doc.section}
                isLoading={isLoading}
                before={<Head view={doc.head} isLoading={isLoading} on={props.on} />}
                body={
                    <>
                        <KnowledgeRowsSlot
                            label={props.props.passagesLabel}
                            slot={props.props.passages}
                            slotLabels={props.props.passagesLabels}
                            isPending={props.props.isPending}
                            onRetry={props.on.retry}
                        />
                        <Disclosure
                            title={doc.head.contentTitle}
                            body={
                                <Text size="sm" isLoading={isLoading}>
                                    {doc.head.content}
                                </Text>
                            }
                        />
                    </>
                }
            />
        )}
    />
)
