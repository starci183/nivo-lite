import { AlertDialog, Badge, Button, Disclosure, Meter, Text } from "@starci/grammar/common"
import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowsProps } from "@/components/composites/KnowledgeRows"
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
    readonly isSkeleton: boolean
}

/** The list of passages and the head the connected document supplies. */
export interface KnowledgeSourcePanelBaseProps {
    readonly props: {
        readonly list: KnowledgeRowsProps
        readonly head: HeadView
    }
    readonly on: {
        readonly reindex: () => void
        readonly toggleVisibility: () => void
        readonly remove: () => void
    }
}

/** What the head draws and calls. */
interface HeadProps {
    readonly view: HeadView
    readonly on: KnowledgeSourcePanelBaseProps["on"]
}

/** The status and facts of the document and what the owner may do to it. */
const Head = (props: HeadProps) => (
    <>
        <div className={FACTS_CLASS_NAME}>
            <Badge tone={props.view.statusTone} isSkeleton={props.view.isSkeleton}>
                {props.view.statusLabel}
            </Badge>
            <Badge tone="neutral" isSkeleton={props.view.isSkeleton}>
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
                <Button intent="neutral" isPending={props.view.isBusy} onPress={props.on.reindex}>
                    {props.view.reindexLabel}
                </Button>
                <Button intent="neutral" isPending={props.view.isBusy} onPress={props.on.toggleVisibility}>
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
                        <Button intent="destructive" step="entry" isPending={props.view.isBusy}>
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
    <KnowledgeRows
        {...props.props.list}
        before={<Head view={props.props.head} on={props.on} />}
        after={
            <Disclosure title={props.props.head.contentTitle}>
                <Text size="sm">{props.props.head.content}</Text>
            </Disclosure>
        }
    />
)
