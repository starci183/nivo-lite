import type { HiringViews, HiringActions } from "@/modules/types"

interface HiringPipelineBoardProps extends Omit<HiringViews["pipelineFields"], "isRejectOpen" | "reject"> {
    readonly on: HiringActions["pipelineBoardActions"]
    readonly isLoading: boolean
}
import {
    Alert,
    Button,
    Cluster,
    EmptyNotice,
    HorizontalScrollRegion,
    Section,
    Select,
    Stack,
    Text,
    type ListRowData,
} from "@starci/grammar/common"

import {
    BOARD_CLASS_NAME,
    BOARD_FRAME_CLASS_NAME,
    CARD_DRAG_CLASS_NAME,
    LANE_CLASS_NAME,
    LIST_CLASS_NAME,
} from "./classNames"

/** Draws the candidates tab: one lane per stage on wide screens (drag a card, or use "Move to"), a stacked list on phones. */
export const HiringPipelineBoard = (props: HiringPipelineBoardProps) => {
    const { copy, jobId, jobOptions, hasNoCandidates, withdrawnNote, error } = props
    const { on } = props
    return (
        <>
            <Section
                isLoading={props.isLoading}
                title={copy.title}
                action={
                    <Select
                        isLoading={props.isLoading}
                        label={copy.jobLabel}
                        isLabelHidden
                        value={jobId}
                        options={jobOptions}
                        onValueChange={(id) => on.job(id ?? jobId)}
                    />
                }
            >
                {error === null ? null : (
                    <Alert
                        tone="negative"
                        title={copy.moveFailed}
                        description={error}
                        dismissLabel={copy.dismissLabel}
                        onDismiss={on.clearError}
                    />
                )}
                {hasNoCandidates ? (
                    <EmptyNotice message={copy.emptyTitle} description={copy.emptyBody} />
                ) : (
                    <>
                        <PipelineBoard {...props} />
                        <PipelinePhoneLanes {...props} />
                        {withdrawnNote === null ? null : (
                            <Text isLoading={props.isLoading} size="sm" tone="muted">
                                {withdrawnNote}
                            </Text>
                        )}
                    </>
                )}
            </Section>
        </>
    )
}

/** One candidate as a row of its lane's list: the name, the score, and under the row its move commands (and the drag handle on the board). */
const pipelineItem = (
    props: HiringPipelineBoardProps,
    view: HiringViews["pipelineCard"],
    isDraggable: boolean,
): ListRowData => {
    const { copy, isBusy } = props
    const { on } = props
    return {
        id: view.id,
        title: view.name,
        description: view.meta,
        badges: [{ label: view.scoreLabel, tone: view.scoreTone }],
        detail: (
            <div
                className={isDraggable ? CARD_DRAG_CLASS_NAME : undefined}
                draggable={isDraggable}
                onDragStart={
                    isDraggable
                        ? (event) => {
                              event.dataTransfer.setData("text/plain", view.id)
                              event.dataTransfer.effectAllowed = "move"
                              on.dragStart(view.id)
                          }
                        : undefined
                }
                onDragEnd={isDraggable ? on.dragEnd : undefined}
            >
                <Stack gap="inline">
                    {view.suggestion === null ? null : (
                        <Text isLoading={props.isLoading} size="xs">
                            {view.suggestion}
                        </Text>
                    )}
                    <Cluster gap="inline">
                        <Button endArrow isLoading={props.isLoading} intent="dismiss" size="sm" onPress={() => on.open(view.id)}>
                            {copy.openLabel}
                        </Button>
                    </Cluster>
                    <Select
                        isLoading={props.isLoading}
                        label={copy.moveToLabel}
                        isLabelHidden
                        isDisabled={isBusy}
                        placeholder={copy.movePlaceholder}
                        value={null}
                        options={view.moveOptions}
                        onValueChange={(stage) => {
                            if (stage !== null) on.move(view.id, stage)
                        }}
                    />
                </Stack>
            </div>
        ),
    }
}

/** Draws the drag-enabled stage lanes on wide screens, retaining the same card builder and handlers. */
const PipelineBoard = (props: HiringPipelineBoardProps) => {
    const { copy, lanes } = props
    const { on } = props
    return (
        <div className={BOARD_FRAME_CLASS_NAME}>
            <HorizontalScrollRegion overflow="needed" aria-label={copy.boardLabel}>
                <div className={BOARD_CLASS_NAME}>
                    <Cluster gap="row" wrap={false} align="start">
                        {lanes.map((lane) => (
                            <div
                                key={lane.stage}
                                className={LANE_CLASS_NAME}
                                onDragOver={(event) => {
                                    if (props.dragId === null) return
                                    event.preventDefault()
                                    on.dragOver(lane.stage)
                                }}
                                onDragLeave={() => on.dragLeave(lane.stage)}
                                onDrop={(event) => {
                                    event.preventDefault()
                                    on.drop(lane.stage, event.dataTransfer.getData("text/plain"))
                                }}
                            >
                                <Section
                                    isLoading={props.isLoading}
                                    kind="list"
                                    title={lane.label}
                                    fact={lane.count}
                                    items={lane.cards.map((view) => pipelineItem(props, view, true))}
                                    empty={<EmptyNotice message={copy.laneEmpty} />}
                                />
                            </div>
                        ))}
                    </Cluster>
                </div>
            </HorizontalScrollRegion>
        </div>
    )
}

/** Draws the nonempty stage lanes in the phone list, retaining the same card builder and handlers. */
const PipelinePhoneLanes = (props: HiringPipelineBoardProps) => {
    const { copy, lanes } = props
    return (
        <div className={LIST_CLASS_NAME}>
            <Stack gap="row">
                {lanes
                    .filter((lane) => lane.cards.length > 0)
                    .map((lane) => (
                        <Section
                            isLoading={props.isLoading}
                            key={lane.stage}
                            kind="list"
                            title={lane.label}
                            fact={lane.count}
                            items={lane.cards.map((view) => pipelineItem(props, view, false))}
                            empty={<EmptyNotice message={copy.laneEmpty} />}
                        />
                    ))}
            </Stack>
        </div>
    )
}
