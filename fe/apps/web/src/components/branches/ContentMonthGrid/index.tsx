import type { ContentViews } from "@/modules/types"
import { parseDate } from "@internationalized/date"
import {
    Button,
    CalendarDay,
    DataTable,
    type DataTableCellInteraction,
    EmptyNotice,
    Stack,
} from "@starci/grammar/common"
import { ContentPostChip } from "@/components/leaves/ContentPostChip"

import { CELL_CLASS_NAME } from "./classNames"

/** Props of {@link ContentMonthGrid}. */
interface ContentMonthGridProps {
    /** The month title, already formatted. */
    readonly title: string
    readonly cells: ReadonlyArray<ContentViews["calendarCell"]>
    readonly todayKey: string
    readonly pickedId: string | null
    readonly overKey: string | null
    readonly canManage: boolean
    readonly weekdays: ReadonlyArray<string>
    readonly copy: ContentViews["workbenchCopy"]
    readonly isLoading: boolean
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
            isLoading={props.isLoading}
            label={props.title}
            columns={props.weekdays.map((label, index) => ({ id: String(index), label }))}
            rows={rows}
            emptyContent={<EmptyNotice message={props.copy.emptyMonthTitle} />}
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
    cell: ContentViews["calendarCell"] | undefined,
): DataTableCellInteraction | undefined => {
    if (cell?.day == null) return undefined
    const day = cell.day
    const key = cell.dateKey
    return {
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
    readonly cell: ContentViews["calendarCell"]
}

/** The posts and explicit toggle used to pick a post without dragging. */
const MonthDayCell = ({ props, cell }: MonthDayCellProps) => {
    const key = cell.dateKey
    const today = key === props.todayKey
    return (
        <div className={CELL_CLASS_NAME}>
            <Stack gap="identity">
                <CalendarDay value={parseDate(cell.dateKey)} label={cell.label} isToday={today} />
                {cell.posts.map((post) => (
                    <Stack key={post.id} gap="identity">
                        <ContentPostChip
                            post={post}
                            draggable={props.canManage && post.canMove}
                            onOpen={props.onOpen}
                            onDragStart={props.onDragStart}
                            onDragEnd={props.onDragEnd}
                        />
                        {props.canManage && post.canMove ? (
                            <Button
                                isLoading={props.isLoading}
                                intent="neutral"
                                size="sm"
                                aria-pressed={props.pickedId === post.id}
                                onPress={() => props.onPick(post.id)}
                            >
                                {post.pickLabel}
                            </Button>
                        ) : null}
                    </Stack>
                ))}
                {cell.moreLabel !== null ? (
                    <Button intent="neutral" size="sm" onPress={() => props.onExpand(key)}>
                        {cell.moreLabel}
                    </Button>
                ) : null}
            </Stack>
        </div>
    )
}
