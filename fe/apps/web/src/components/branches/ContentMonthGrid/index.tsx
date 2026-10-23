import { Button, DataTable, type DataTableCellInteraction, EmptyNotice, Text } from "@starci/grammar/common"
import { ContentPostChip } from "@/components/leaves/ContentPostChip"
import type { ContentT, PostView } from "@/hooks/content"
import { CELL_CLASS_NAME, POST_CLASS_NAME } from "./classNames"

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
    readonly pickedId: string | null
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
    readonly onPick: (id: string) => void
}

/** The scheduling month uses semantic week rows; cells share pointer and keyboard placement. */
export const ContentMonthGrid = (props: ContentMonthGridProps) => {
    const rows = Array.from({ length: Math.ceil(props.cells.length / 7) }, (_, week) => ({
        id: String(week),
        cells: props.cells.slice(week * 7, (week + 1) * 7),
    }))
    return (
        <DataTable
            label={props.title}
            columns={props.weekdays.map((label, index) => ({ id: String(index), label }))}
            rows={rows}
            emptyContent={<EmptyNotice message={props.t("emptyMonthTitle")} />}
            getCellInteraction={(row, columnId) => monthCellInteraction(props, row.cells[Number(columnId)])}
            renderCell={(row, columnId) => {
                const cell = row.cells[Number(columnId)]
                return cell?.day == null ? null : <MonthDayCell props={props} cell={cell} />
            }}
        />
    )
}

const monthCellInteraction = (
    props: ContentMonthGridProps,
    cell: GridCell | undefined,
): DataTableCellInteraction | undefined => {
    if (cell?.day == null) return { tone: "muted" }
    const day = cell.day
    const key = cell.dateKey
    return {
        isHighlighted: props.overKey === key || props.todayKey === key,
        ...(props.pickedId !== null && props.canManage ? { onAction: () => props.onDrop(day) } : {}),
        onDragOver: (event) => {
            if (props.pickedId === null) return
            event.preventDefault()
            props.onDragOver(key)
        },
        onDragLeave: () => props.onDragLeave(key),
        onDrop: (event) => {
            event.preventDefault()
            props.onDrop(day)
        },
    }
}

type MonthDayCellProps = {
    readonly props: ContentMonthGridProps
    readonly cell: GridCell
}

/** The posts and explicit toggle used to pick a post without dragging. */
const MonthDayCell = ({ props, cell }: MonthDayCellProps) => {
    const key = cell.dateKey
    const list = props.byDay.get(key) ?? []
    const shown = props.expandedKey === key ? list : list.slice(0, MAX_CHIPS)
    const today = key === props.todayKey
    return (
        <div className={CELL_CLASS_NAME}>
            <Text as="span" size="xs" weight={today ? "semibold" : "normal"} tone={today ? "accent" : "muted"}>
                {cell.day}
            </Text>
            {shown.map((post) => (
                <div key={post.id} className={POST_CLASS_NAME}>
                    <ContentPostChip
                        post={post}
                        draggable={props.canManage && post.canMove}
                        onOpen={props.onOpen}
                        onDragStart={props.onDragStart}
                        onDragEnd={props.onDragEnd}
                    />
                    {props.canManage && post.canMove ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            aria-pressed={props.pickedId === post.id}
                            onPress={() => props.onPick(post.id)}
                        >
                            {props.t("calendarPickMove")}: {post.title}
                        </Button>
                    ) : null}
                </div>
            ))}
            {list.length > MAX_CHIPS && props.expandedKey !== key ? (
                <Button variant="ghost" size="sm" onPress={() => props.onExpand(key)}>
                    {props.t("moreItems", { n: list.length - MAX_CHIPS })}
                </Button>
            ) : null}
        </div>
    )
}
