import { Button, SurfaceCard, Text } from "@starci/grammar/common"
import { ContentPostChip } from "@/components/leaves/ContentPostChip"
import type { ContentT, PostView } from "@/hooks/content"
import { GRID_CLASS_NAME, GRID_HEAD_CLASS_NAME, OUT_CELL_CLASS_NAME, cellClassName } from "./classNames"

/** The most chips one day shows before "+n more". */
const MAX_CHIPS = 3

/** One cell of the month grid; a null day is outside the month. */
export interface GridCell {
    /** A stable key of the cell. */
    readonly key: string
    readonly day: number | null
    /** The yyyy-mm-dd key of the day, empty outside the month. */
    readonly dateKey: string
}

/** Props of {@link ContentMonthGrid}. */
interface ContentMonthGridProps {
    /** The month title, already formatted. */
    readonly title: string
    readonly cells: ReadonlyArray<GridCell>
    /** Posts by yyyy-mm-dd key. */
    readonly byDay: ReadonlyMap<string, ReadonlyArray<PostView>>
    readonly todayKey: string
    readonly dragging: boolean
    readonly overKey: string | null
    readonly expandedKey: string | null
    readonly canManage: boolean
    readonly weekdays: ReadonlyArray<string>
    readonly t: ContentT
    readonly onOpen: (id: string) => void
    readonly onDragStart: (id: string) => void
    readonly onDragEnd: () => void
    readonly onDragOver: (key: string) => void
    readonly onDragLeave: (key: string) => void
    readonly onDrop: (day: number) => void
    readonly onExpand: (key: string) => void
}

/**
 * The month as a grid of droppable day cells. Grammar gap: Common has no scheduling month grid (Calendar is a date picker), so the grid and
 * its cells stay app-owned inside a joined SurfaceCard, which owns the face, corner and edge.
 */
export const ContentMonthGrid = (props: ContentMonthGridProps) => (
    <SurfaceCard ariaLabel={props.title} composition="joined">
        <div className={GRID_CLASS_NAME} role="grid" aria-label={props.title}>
            {props.weekdays.map((d) => (
                <div key={d} role="columnheader" className={GRID_HEAD_CLASS_NAME}>
                    <Text as="span" size="xs" weight="semibold">
                        {d}
                    </Text>
                </div>
            ))}
            {props.cells.map((cell) => {
                const day = cell.day
                if (day === null) {
                    return <div key={cell.key} className={OUT_CELL_CLASS_NAME} role="gridcell" aria-hidden />
                }
                const key = cell.dateKey
                const list = props.byDay.get(key) ?? []
                const shown = props.expandedKey === key ? list : list.slice(0, MAX_CHIPS)
                const today = key === props.todayKey
                return (
                    <div
                        key={cell.key}
                        role="gridcell"
                        aria-label={`${day}/${key.slice(5, 7)}`}
                        className={cellClassName(today, props.overKey === key)}
                        onDragOver={(event) => {
                            if (props.dragging) {
                                event.preventDefault()
                                props.onDragOver(key)
                            }
                        }}
                        onDragLeave={() => props.onDragLeave(key)}
                        onDrop={(event) => {
                            event.preventDefault()
                            props.onDrop(day)
                        }}
                    >
                        <Text
                            as="span"
                            size="xs"
                            weight={today ? "semibold" : "normal"}
                            tone={today ? "accent" : "muted"}
                        >
                            {day}
                        </Text>
                        {shown.map((post) => (
                            <ContentPostChip
                                key={post.id}
                                post={post}
                                draggable={props.canManage && post.canMove}
                                onOpen={props.onOpen}
                                onDragStart={props.onDragStart}
                                onDragEnd={props.onDragEnd}
                            />
                        ))}
                        {list.length > MAX_CHIPS && props.expandedKey !== key ? (
                            <Button variant="ghost" size="sm" onPress={() => props.onExpand(key)}>
                                {props.t("moreItems", { n: list.length - MAX_CHIPS })}
                            </Button>
                        ) : null}
                    </div>
                )
            })}
        </div>
    </SurfaceCard>
)
