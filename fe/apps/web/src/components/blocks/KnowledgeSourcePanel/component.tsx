import { AlertDialog, Badge, Button, Disclosure, Meter, Text } from "@starci/grammar/common"
import {
    KNOWLEDGE_ROWS_PLACEHOLDER,
    KnowledgeRowList,
    KnowledgeRowsSection,
} from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowView, SectionView } from "@/components/composites/KnowledgeRows"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ACTIONS_CLASS_NAME, FACTS_CLASS_NAME } from "./classNames"

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
    readonly visibilityActionLabel: string
    readonly deleteLabel: string
    readonly deleteQuestion: string
    readonly deleteConfirm: string
    readonly cancelLabel: string
    readonly contentTitle: string
    readonly content: string
    readonly isBusy: boolean
}

/** The document as its slot carries it: the heading, the head and the text. */
export interface SourceDocView {
    readonly section: SectionView
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
        visibilityActionLabel: "-",
        deleteLabel: "-",
        deleteQuestion: "-",
        deleteConfirm: "-",
        cancelLabel: "-",
        contentTitle: "-",
        content: "-",
        isBusy: false,
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
        readonly toggleVisibility: () => void
        readonly remove: () => void
        readonly retry: () => void
    }
}

/** What the head draws and calls. */
interface HeadProps {
    readonly view: HeadView
    readonly isSkeleton: boolean
    readonly on: KnowledgeSourcePanelBaseProps["on"]
}

/** The status and facts of the document and what the owner may do to it. */
const Head = (props: HeadProps) => (
    <>
        <div className={FACTS_CLASS_NAME}>
            <Badge tone={props.view.statusTone} isSkeleton={props.isSkeleton}>
                {props.view.statusLabel}
            </Badge>
            <Badge tone="neutral" isSkeleton={props.isSkeleton}>
                {props.view.visibilityLabel}
            </Badge>
        </div>
        {props.view.progress === undefined ? null : (
            <Meter label={props.view.statusLabel} value={props.view.progress} isLabelHidden />
        )}
        {props.view.note === undefined ? null : (
            <Text size="sm" tone="muted">
                {props.view.note}
            </Text>
        )}
        {props.view.canWrite ? (
            <div className={ACTIONS_CLASS_NAME}>
                <Button
                    intent="neutral"
                    isSkeleton={props.isSkeleton}
                    isPending={props.view.isBusy}
                    onPress={props.on.reindex}
                >
                    {props.view.reindexLabel}
                </Button>
                <Button
                    intent="neutral"
                    isSkeleton={props.isSkeleton}
                    isPending={props.view.isBusy}
                    onPress={props.on.toggleVisibility}
                >
                    {props.view.visibilityActionLabel}
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
                            isSkeleton={props.isSkeleton}
                            isPending={props.view.isBusy}
                        >
                            {props.view.deleteLabel}
                        </Button>
                    }
                />
            </div>
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
    >
        {(doc, isSkeleton) => (
            <KnowledgeRowsSection
                section={doc.section}
                isPending={props.props.isPending}
                isSkeleton={isSkeleton}
                before={<Head view={doc.head} isSkeleton={isSkeleton} on={props.on} />}
            >
                <SlotView
                    slot={props.props.passages}
                    placeholder={KNOWLEDGE_ROWS_PLACEHOLDER}
                    labels={props.props.passagesLabels}
                    onRetry={props.on.retry}
                >
                    {(rows, isRowsSkeleton) => (
                        <KnowledgeRowList
                            label={props.props.passagesLabel}
                            rows={rows}
                            isPending={props.props.isPending}
                            isSkeleton={isRowsSkeleton}
                        />
                    )}
                </SlotView>
                <Disclosure title={doc.head.contentTitle}>
                    <Text size="sm" isSkeleton={isSkeleton}>
                        {doc.head.content}
                    </Text>
                </Disclosure>
            </KnowledgeRowsSection>
        )}
    </SlotView>
)
