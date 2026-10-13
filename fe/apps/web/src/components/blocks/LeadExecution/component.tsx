import { Alert, Button, List, ListItem, Region, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { ApprovalCard } from "@/components/composites/ApprovalCard"
import type { ApprovalCardLabels, ApprovalCardView } from "@/components/composites/ApprovalCard"
import type { DataSlot, SlotLabels } from "@/modules/types"
import {
    CARD_BODY_CLASS_NAME,
    EARLIER_LIST_CLASS_NAME,
    EARLIER_SECTION_CLASS_NAME,
    PANEL_CLASS_NAME,
} from "./classNames"

/** One draft with what its approval card says about it. */
export interface DraftItem {
    readonly id: string
    readonly view: ApprovalCardView
}

/** What the panel shows about one lead. */
export interface ExecutionView {
    readonly explanation: string
    readonly canDraft: boolean
    /** The draft waiting for a decision; with none, the draft card is drawn. */
    readonly waiting: DraftItem | null
    readonly earlier: ReadonlyArray<DraftItem>
}

/** The words of the panel. */
export interface ExecutionLabels {
    readonly cardLabel: string
    readonly buttonLabel: string
    readonly failTitle: string
    readonly earlierTitle: string
    readonly earlierMeta: string
    readonly slot: SlotLabels
    readonly approval: ApprovalCardLabels
}

/** The words and state of the execution panel. */
export interface LeadExecutionBaseProps {
    readonly props: {
        readonly slot: DataSlot<ExecutionView>
        readonly labels: ExecutionLabels
        readonly error: string | null
        readonly isPending: boolean
        /** Said while a draft is being written; empty otherwise. */
        readonly draftingText: string
    }
    readonly on: {
        readonly draft: () => void
        readonly toggleEdit: () => void
        readonly editChange: (value: string) => void
        readonly decide: (decision: "approved" | "rejected") => void
    }
}

const PLACEHOLDER: ExecutionView = { explanation: "", canDraft: false, waiting: null, earlier: [] }

/** Human x AI execution: draft with the owning agent, then approve, edit or reject before anything is sent. */
export const LeadExecutionBase = (props: LeadExecutionBaseProps) => {
    const { props: p, on } = props
    const l = p.labels
    return (
        <div id="execution" className={PANEL_CLASS_NAME}>
            <SlotView slot={p.slot} placeholder={PLACEHOLDER} labels={l.slot}>
                {(view, isSkeleton) => (
                    <>
                        {view.waiting === null ? (
                            <SurfaceCard label={l.cardLabel} headingLevel={2}>
                                <div className={CARD_BODY_CLASS_NAME}>
                                    <Text tone="muted" isSkeleton={isSkeleton}>
                                        {view.explanation}
                                    </Text>
                                    {p.error === null ? null : (
                                        <Alert tone="negative" title={l.failTitle} description={p.error} />
                                    )}
                                    <Text size="sm" tone="muted" live="polite">
                                        {p.draftingText}
                                    </Text>
                                    <Button
                                        variant="primary"
                                        isSkeleton={isSkeleton}
                                        isPending={p.isPending}
                                        isDisabled={!view.canDraft}
                                        onPress={on.draft}
                                    >
                                        {l.buttonLabel}
                                    </Button>
                                </div>
                            </SurfaceCard>
                        ) : (
                            <ApprovalCard view={view.waiting.view} labels={l.approval} on={on} />
                        )}
                        {view.earlier.length === 0 ? null : (
                            <Region labelledBy="earlier-approvals-title" className={EARLIER_SECTION_CLASS_NAME}>
                                <SectionHeader
                                    id="earlier-approvals-title"
                                    level={2}
                                    title={l.earlierTitle}
                                    meta={l.earlierMeta}
                                />
                                <List className={EARLIER_LIST_CLASS_NAME} label={l.earlierTitle}>
                                    {view.earlier.map((item) => (
                                        <ListItem key={item.id}>
                                            <ApprovalCard view={item.view} labels={l.approval} on={on} />
                                        </ListItem>
                                    ))}
                                </List>
                            </Region>
                        )}
                    </>
                )}
            </SlotView>
        </div>
    )
}
