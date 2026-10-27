import {
    Alert,
    Button,
    EmptyNotice,
    ListBox,
    ListRow,
    SurfaceCard,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import { ContentMonthGrid, type GridCell } from "@/components/branches/ContentMonthGrid"
import { ContentMonthBar } from "@/components/leaves/ContentMonthBar"
import { ContentPostFacts } from "@/components/leaves/ContentPostFacts"
import { ContentStatusBadge } from "@/components/leaves/ContentStatusBadge"
import type { ContentT, PostView } from "@/modules/types"
import { AGENDA_CLASS_NAME, GRID_WRAP_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** What the calendar panel draws. */
export interface ContentCalendarPanelBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly y: number
        readonly m: number
        /** The title of the month, already formatted. */
        readonly title: string
        readonly cells: ReadonlyArray<GridCell>
        readonly byDay: ReadonlyMap<string, ReadonlyArray<PostView>>
        readonly monthItems: ReadonlyArray<PostView>
        readonly unscheduled: ReadonlyArray<PostView>
        readonly todayKey: string
        readonly pickedId: string | null
        readonly overKey: string | null
        readonly expandedKey: string | null
        readonly canManage: boolean
        readonly isEmptySetup: boolean
        readonly note: { readonly tone: "ok" | "error"; readonly text: string } | null
    }
    readonly on: {
        readonly shift: (by: number) => void
        readonly today: () => void
        readonly open: (id: string) => void
        readonly dragStart: (id: string) => void
        readonly pick: (id: string) => void
        readonly dragEnd: () => void
        readonly dragOver: (key: string) => void
        readonly dragLeave: (key: string) => void
        readonly drop: (day: number) => void
        readonly expand: (key: string) => void
        readonly dismissNote: () => void
    }
}

/**
 * Draws the month calendar: a droppable grid on wide screens (drag a post to another day to reschedule), the same month as an agenda
 * list on phones, and the posts that have no date yet.
 */
export const ContentCalendarPanelBase = (props: ContentCalendarPanelBaseProps) => {
    const { t, title } = props.props
    if (props.props.isEmptySetup) {
        return (
            <SurfaceCard ariaLabel={t("setupFirstTitle")}>
                <EmptyNotice message={t("setupFirstTitle")} description={t("setupFirstBody")} />
            </SurfaceCard>
        )
    }
    return (
        <div className={PANEL_CLASS_NAME}>
            {props.props.note ? (
                <Alert
                    title={props.props.note.text}
                    tone={props.props.note.tone === "ok" ? "affirmative" : "negative"}
                    dismissLabel={t("close")}
                    onDismiss={props.on.dismissNote}
                />
            ) : null}
            <ContentMonthBar title={title} t={t} onShift={props.on.shift} onToday={props.on.today} />
            {renderContentCalendarGrid(title, props, t)}
            <div className={AGENDA_CLASS_NAME}>
                <SurfaceCard ariaLabel={title}>
                    {props.props.monthItems.length === 0 ? (
                        <EmptyNotice message={t("emptyMonthTitle")} description={t("emptyMonthBody")} />
                    ) : (
                        <ListBox
                            label={title}
                            selectionMode="none"
                            onAction={props.on.open}
                            items={props.props.monthItems.map((i) => ({
                                id: i.id,
                                label: i.title,
                                description: (
                                    <ContentPostFacts post={i} showBrief={false} showPillar noPillar={t("noPillar")} />
                                ),
                                trailing: <ContentStatusBadge tone={i.tone} label={i.statusLabel} />,
                            }))}
                        />
                    )}
                </SurfaceCard>
            </div>
            {props.props.unscheduled.length > 0 ? (
                <SurfaceListCard label={t("noDateTitle")} headingLevel={2}>
                    {props.props.unscheduled.map((i) => (
                        <ListRow
                            key={i.id}
                            title={i.title}
                            description={
                                <ContentPostFacts post={i} showBrief={false} showPillar noPillar={t("noPillar")} />
                            }
                            badges={<ContentStatusBadge tone={i.tone} label={i.statusLabel} />}
                            actions={
                                <Button intent="neutral" size="sm" onPress={() => props.on.open(i.id)}>
                                    {t("queueOpen")}
                                </Button>
                            }
                        />
                    ))}
                </SurfaceListCard>
            ) : null}
        </div>
    )
}

/** Draws the div section of the ContentCalendarPanel view. */
const renderContentCalendarGrid = (
    title: ContentCalendarPanelBaseProps["props"]["title"],
    props: ContentCalendarPanelBaseProps,
    t: ContentCalendarPanelBaseProps["props"]["t"],
) => {
    return (
        <div className={GRID_WRAP_CLASS_NAME}>
            <ContentMonthGrid
                title={title}
                cells={props.props.cells}
                byDay={props.props.byDay}
                todayKey={props.props.todayKey}
                pickedId={props.props.pickedId}
                overKey={props.props.overKey}
                expandedKey={props.props.expandedKey}
                canManage={props.props.canManage}
                weekdays={t("weekdays").split(",")}
                t={t}
                onOpen={props.on.open}
                onDragStart={props.on.dragStart}
                onPick={props.on.pick}
                onDragEnd={props.on.dragEnd}
                onDragOver={props.on.dragOver}
                onDragLeave={props.on.dragLeave}
                onDrop={props.on.drop}
                onExpand={props.on.expand}
            />
            {props.props.canManage ? (
                <Text size="xs" tone="muted">
                    {t("dragHint")}
                </Text>
            ) : null}
            {props.props.monthItems.length === 0 ? (
                <Text size="sm" tone="muted">
                    {t("emptyMonthBody")}
                </Text>
            ) : null}
        </div>
    )
}
