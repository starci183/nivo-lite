import { Alert, Button, List, ListItem, Region, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { ApprovalCard } from "@/components/blocks/ApprovalCard"
import type { ExecutionRecord, DataSlot, SlotLabels } from "@/modules/types"
import {
    CARD_BODY_CLASS_NAME,
    EARLIER_LIST_CLASS_NAME,
    EARLIER_SECTION_CLASS_NAME,
    PANEL_CLASS_NAME,
} from "./classNames"

/** One draft with what its approval card says about it. */
export interface DraftItem {
    readonly id: string
    readonly execution: ExecutionRecord
    readonly leadName: string
    readonly channel: string
    readonly agentName: string | null
    readonly nextAction: string
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
                            <ApprovalCard
                                execution={view.waiting.execution}
                                leadName={view.waiting.leadName}
                                channel={view.waiting.channel}
                                agentName={view.waiting.agentName}
                                nextAction={view.waiting.nextAction}
                            />
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
                                            <ApprovalCard
                                                execution={item.execution}
                                                leadName={item.leadName}
                                                channel={item.channel}
                                                agentName={item.agentName}
                                                nextAction={item.nextAction}
                                            />
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
