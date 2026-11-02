import type { ContentViews, ContentActions } from "@/modules/types"

type ContentCalendarViewProps = ContentViews["calendarFields"] & {
    readonly on: ContentActions["calendarActions"]
    readonly isLoading: boolean
}
import { Alert, EmptyNotice, ListBox, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { ContentMonthGrid } from "@/components/branches/ContentMonthGrid"
import { ContentMonthBar } from "@/components/leaves/ContentMonthBar"
import { ContentPostFacts } from "@/components/leaves/ContentPostFacts"
import { ContentStatusBadge } from "@/components/leaves/ContentStatusBadge"
import { AGENDA_CLASS_NAME, GRID_WRAP_CLASS_NAME } from "./classNames"

/**
 * Draws the month calendar: a droppable grid on wide screens (drag a post to another day to reschedule), the same month as an agenda
 * list on phones, and the posts that have no date yet.
 */
export const ContentCalendarView = (props: ContentCalendarViewProps) => {
    const { copy, title } = props
    if (props.isEmptySetup) {
        return (
            <SurfaceCard isLoading={props.isLoading} ariaLabel={copy.setupFirstTitle}>
                <EmptyNotice message={copy.setupFirstTitle} description={copy.setupFirstBody} />
            </SurfaceCard>
        )
    }
    return (
        <Stack gap="row">
            {props.note ? (
                <Alert
                    title={props.note.text}
                    tone={props.note.tone === "ok" ? "affirmative" : "negative"}
                    dismissLabel={copy.close}
                    onDismiss={props.on.dismissNote}
                />
            ) : null}
            <ContentMonthBar
                isLoading={props.isLoading}
                title={title}
                copy={copy}
                onShift={props.on.shift}
                onToday={props.on.today}
            />
            {renderContentCalendarGrid(title, props, copy)}
            <div className={AGENDA_CLASS_NAME}>
                <SurfaceCard isLoading={props.isLoading} ariaLabel={title}>
                    {props.isMonthEmpty ? (
                        <EmptyNotice message={copy.emptyMonthTitle} description={copy.emptyMonthBody} />
                    ) : (
                        <ListBox
                            isLoading={props.isLoading}
                            label={title}
                            selectionMode="none"
                            onAction={props.on.open}
                            items={props.monthItems.map((i) => ({
                                id: i.id,
                                label: i.title,
                                description: (
                                    <ContentPostFacts post={i} showBrief={false} showPillar noPillar={copy.noPillar} />
                                ),
                                trailing: <ContentStatusBadge tone={i.tone} label={i.statusLabel} />,
                            }))}
                        />
                    )}
                </SurfaceCard>
            </div>
            {props.unscheduled.length > 0 ? (
                <SurfaceCard
                    isLoading={props.isLoading}
                    kind="list"
                    label={copy.noDateTitle}
                    headingLevel={2}
                    items={props.unscheduled.map((i) => ({
                        id: i.id,
                        title: i.title,
                        badges: [{ label: i.statusLabel, tone: i.tone, isDot: true }],
                        action: { label: copy.queueOpen, intent: "neutral" as const, press: () => props.on.open(i.id) },
                        detail: <ContentPostFacts post={i} showBrief={false} showPillar noPillar={copy.noPillar} />,
                    }))}
                    empty={<EmptyNotice message={copy.noDateTitle} />}
                />
            ) : null}
        </Stack>
    )
}

/** Draws the div section of the ContentCalendarPanel view. */
const renderContentCalendarGrid = (
    title: ContentCalendarViewProps["title"],
    props: ContentCalendarViewProps,
    copy: ContentCalendarViewProps["copy"],
) => {
    return (
        <div className={GRID_WRAP_CLASS_NAME}>
            <Stack gap="inline">
                <ContentMonthGrid
                    isLoading={props.isLoading}
                    title={title}
                    cells={props.cells}
                    todayKey={props.todayKey}
                    pickedId={props.pickedId}
                    overKey={props.overKey}
                    canManage={props.canManage}
                    weekdays={props.weekdays}
                    copy={copy}
                    onOpen={props.on.open}
                    onDragStart={props.on.dragStart}
                    onPick={props.on.pick}
                    onDragEnd={props.on.dragEnd}
                    onDragOver={props.on.dragOver}
                    onDragLeave={props.on.dragLeave}
                    onDrop={props.on.drop}
                    onExpand={props.on.expand}
                />
                {props.canManage ? (
                    <Text isLoading={props.isLoading} size="xs" tone="muted">
                        {copy.dragHint}
                    </Text>
                ) : null}
                {props.isMonthEmpty ? (
                    <Text isLoading={props.isLoading} size="sm" tone="muted">
                        {copy.emptyMonthBody}
                    </Text>
                ) : null}
            </Stack>
        </div>
    )
}
