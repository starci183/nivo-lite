import type { DragEvent } from "react"
import {
    Alert,
    Badge,
    Button,
    EmptyNotice,
    Heading,
    HorizontalScrollRegion,
    ListRow,
    Select,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { HiringRejectDialog } from "@/components/composites/HiringRejectDialog"
import type { HiringRejectDialogProps } from "@/components/composites/HiringRejectDialog"
import type { HiringSay } from "@/hooks/hiring"
import {
    ACTIONS_CLASS_NAME,
    BOARD_CLASS_NAME,
    BOARD_FRAME_CLASS_NAME,
    CARD_CLASS_NAME,
    CARD_DRAG_CLASS_NAME,
    HEAD_CLASS_NAME,
    LANE_CLASS_NAME,
    LIST_CLASS_NAME,
} from "./classNames"

/** One candidate card, every word already resolved. */
interface PipelineCardView {
    readonly id: string
    readonly name: string
    readonly scoreLabel: string
    readonly scoreTone: BadgeTone
    readonly meta: string
    readonly suggestion: string | null
    readonly moveOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

/** One stage lane. */
interface PipelineLaneView {
    readonly stage: string
    readonly label: string
    readonly count: string
    readonly cards: ReadonlyArray<PipelineCardView>
}

/** What the connected block settled for the candidates tab. */
export interface HiringPipelineBaseProps {
    readonly props: {
        readonly say: HiringSay
        readonly jobId: string
        readonly jobOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly lanes: ReadonlyArray<PipelineLaneView>
        readonly hasNoCandidates: boolean
        readonly withdrawnNote: string | null
        readonly overStage: string | null
        readonly isBusy: boolean
        readonly error: string | null
        readonly isRejectOpen: boolean
        readonly reject: HiringRejectDialogProps["props"]
    }
    readonly on: {
        readonly job: (id: string) => void
        readonly open: (id: string) => void
        readonly move: (id: string, stage: string) => void
        readonly dragStart: (id: string, event: DragEvent) => void
        readonly dragEnd: () => void
        readonly dragOver: (stage: string, event: DragEvent) => void
        readonly dragLeave: (stage: string) => void
        readonly drop: (stage: string, event: DragEvent) => void
        readonly clearError: () => void
        readonly rejectReason: (value: string) => void
        readonly confirmReject: () => void
        readonly closeReject: () => void
    }
}

/** Draws the candidates tab: one lane per stage on wide screens (drag a card, or use "Move to"), a stacked list on phones. */
export const HiringPipelineBase = (props: HiringPipelineBaseProps) => {
    const { say, jobId, jobOptions, lanes, hasNoCandidates, withdrawnNote, error } = props.props
    const { on } = props
    return (
        <>
            <div className={HEAD_CLASS_NAME}>
                <Heading level={2}>{say("pipeTitle")}</Heading>
                <Select
                    label={say("pipeJob")}
                    isLabelHidden
                    value={jobId}
                    options={jobOptions}
                    onValueChange={(id) => on.job(id ?? jobId)}
                />
            </div>
            {error === null ? null : (
                <Alert
                    tone="negative"
                    title={say("pipeMoveFailed")}
                    description={error}
                    dismissLabel={say("dismiss")}
                    onDismiss={on.clearError}
                />
            )}
            {hasNoCandidates ? (
                <EmptyNotice message={say("pipeEmptyTitle")} description={say("pipeEmptyBody")} />
            ) : (
                <>
                    <div className={BOARD_FRAME_CLASS_NAME}>
                        <HorizontalScrollRegion overflow="needed" aria-label={say("pipeBoard")}>
                            <div className={BOARD_CLASS_NAME}>
                                {lanes.map((lane) => (
                                    <div
                                        key={lane.stage}
                                        className={LANE_CLASS_NAME}
                                        onDragOver={(event) => on.dragOver(lane.stage, event)}
                                        onDragLeave={() => on.dragLeave(lane.stage)}
                                        onDrop={(event) => on.drop(lane.stage, event)}
                                    >
                                        <SurfaceListCard
                                            label={lane.label}
                                            fact={lane.count}
                                            empty={<EmptyNotice message={say("pipeLaneEmpty")} />}
                                        >
                                            {lane.cards.map((view) => (
                                                <PipelineCard key={view.id} {...props} view={view} isDraggable />
                                            ))}
                                        </SurfaceListCard>
                                    </div>
                                ))}
                            </div>
                        </HorizontalScrollRegion>
                    </div>
                    <div className={LIST_CLASS_NAME}>
                        {lanes
                            .filter((lane) => lane.cards.length > 0)
                            .map((lane) => (
                                <SurfaceListCard key={lane.stage} label={lane.label} fact={lane.count}>
                                    {lane.cards.map((view) => (
                                        <PipelineCard key={view.id} {...props} view={view} isDraggable={false} />
                                    ))}
                                </SurfaceListCard>
                            ))}
                    </div>
                    {withdrawnNote === null ? null : (
                        <Text size="sm" tone="muted">
                            {withdrawnNote}
                        </Text>
                    )}
                </>
            )}
            {props.props.isRejectOpen ? (
                <HiringRejectDialog
                    props={props.props.reject}
                    on={{ reason: on.rejectReason, confirm: on.confirmReject, close: on.closeReject }}
                />
            ) : null}
        </>
    )
}

/** One candidate and the commands to move it. */
const PipelineCard = (props: PipelineCardProps) => {
    const { say, isBusy } = props.props
    const { on, view, isDraggable } = props
    return (
        <ListRow
            key={view.id}
            title={view.name}
            badges={<Badge tone={view.scoreTone}>{view.scoreLabel}</Badge>}
            description={view.meta}
        >
            <div
                className={isDraggable ? CARD_DRAG_CLASS_NAME : CARD_CLASS_NAME}
                draggable={isDraggable}
                onDragStart={isDraggable ? (event) => on.dragStart(view.id, event) : undefined}
                onDragEnd={isDraggable ? on.dragEnd : undefined}
            >
                {view.suggestion === null ? null : <Text size="xs">{view.suggestion}</Text>}
                <div className={ACTIONS_CLASS_NAME}>
                    <Button intent="dismiss" size="sm" onPress={() => on.open(view.id)}>
                        {say("pipeOpen")}
                    </Button>
                </div>
                <Select
                    label={say("pipeMoveTo")}
                    isLabelHidden
                    isDisabled={isBusy}
                    placeholder={say("pipeMovePlaceholder")}
                    value={null}
                    options={view.moveOptions}
                    onValueChange={(stage) => {
                        if (stage !== null) on.move(view.id, stage)
                    }}
                />
            </div>
        </ListRow>
    )
}

/** Inputs of the extracted list section. */
type PipelineCardProps = HiringPipelineBaseProps & { readonly view: PipelineCardView; readonly isDraggable: boolean }
