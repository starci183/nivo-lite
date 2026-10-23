import type { useTranslations } from "next-intl"
import type { useShiftsFormat, useShiftsBenchData } from "@/hooks/shifts"
import type { useShiftsWeekCommands } from "@/hooks/shiftsCommands"
import type { useShiftsWeekModel } from "@/hooks/shiftsCoverage"
import {
    Button,
    DataTable,
    type DataTableCellInteraction,
    DragItem,
    EmptyNotice,
    ListItem,
    Region,
    SectionHeader,
    Select,
    SurfaceListCard,
    Tabs,
    Text,
} from "@starci/grammar/common"
import {
    DAYLIST_CLASS_NAME,
    DAY_ROW_CLASS_NAME,
    FRAME_CLASS_NAME,
    NAME_CLASS_NAME,
    SECTION_CLASS_NAME,
    CELL_CLASS_NAME,
} from "./classNames"

/** One shift as a chip of the grid or a line of the day list. */
export interface GridChipView {
    readonly id: string
    readonly time: string
    readonly position: string
    /** The colour of the position, drawn on the leading edge. */
    readonly color: string
    /** The rules this shift breaks, worded; empty when none. */
    readonly why: string
    readonly isOpen: boolean
    readonly isPicked: boolean
}

/** One cell of the grid: a person on a date. */
export interface GridCellView {
    readonly id: string
    readonly date: string
    readonly chips: ReadonlyArray<GridChipView>
    /** A picked shift of this date can be dropped here. */
    readonly canDrop: boolean
    readonly isTarget: boolean
    readonly isOff: boolean
}

/** One person (or the open-shift row) of the grid. */
export interface GridRowView {
    readonly id: string
    readonly name: string
    readonly sub: string
    readonly cells: ReadonlyArray<GridCellView>
}

/** One shift of the selected day with the person it is given to. */
interface GridDayShiftView extends GridChipView {
    readonly staffId: string
    readonly staffName: string
}

/** Copy, rows and state the connected grid supplies. */
export interface ShiftsGridBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly emptyDay: string
        readonly assignLabel: string
        readonly onLeaveLabel: string
        /** The id that stands for "nobody" in the rows and the assign select. */
        readonly openId: string
        readonly editable: boolean
        readonly dates: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly rows: ReadonlyArray<GridRowView>
        readonly selectedDay: string
        readonly dayShifts: ReadonlyArray<GridDayShiftView>
        /** The people a shift can be given to, led by the open choice. */
        readonly assignOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    }
    readonly on: {
        readonly pick: (shiftId: string) => void
        readonly dragStart: (shiftId: string) => void
        readonly dragEnd: () => void
        readonly hover: (cellId: string | null) => void
        readonly drop: (shiftId: string, rowId: string) => void
        readonly place: (rowId: string) => void
        readonly day: (date: string) => void
        readonly assign: (shiftId: string, rowId: string) => void
    }
}

/** Draws the people-by-days grid with draggable shift chips, and the day list that replaces it on phones. */
export const ShiftsGridBase = (props: ShiftsGridBaseProps) => (
    <Region label={props.props.title}>
        <div className={SECTION_CLASS_NAME}>
            <SectionHeader level={2} title={props.props.title} description={props.props.hint} />
            <div className={FRAME_CLASS_NAME}>
                <DataTable
                    label={props.props.title}
                    columns={[
                        { id: "staff", label: "", isRowHeader: true },
                        ...props.props.dates.map((date) => ({ id: date.id, label: date.label })),
                    ]}
                    rows={props.props.rows}
                    emptyContent={<EmptyNotice message={props.props.emptyDay} />}
                    renderCell={(row, columnId) => renderTableCell(props, row, columnId)}
                    getCellInteraction={(row, columnId) => gridCellInteraction(props, row, columnId)}
                />
            </div>
            <div className={DAYLIST_CLASS_NAME}>
                <Tabs
                    variant="secondary"
                    label={props.props.title}
                    selectedKey={props.props.selectedDay}
                    inset="none"
                    labelVisibility="always"
                    items={props.props.dates}
                    onSelect={props.on.day}
                />
                <SurfaceListCard ariaLabel={props.props.title} empty={<EmptyNotice message={props.props.emptyDay} />}>
                    {props.props.dayShifts.map((shift) => (
                        <ListItem key={shift.id} className={DAY_ROW_CLASS_NAME}>
                            <Text size="sm" weight="medium">{`${shift.time} · ${shift.position}`}</Text>
                            {props.props.editable ? (
                                <Select
                                    label={props.props.assignLabel}
                                    isLabelHidden
                                    name={`assign-${shift.id}`}
                                    variant="secondary"
                                    value={shift.staffId}
                                    options={props.props.assignOptions}
                                    onValueChange={(value) => props.on.assign(shift.id, value ?? props.props.openId)}
                                />
                            ) : (
                                <Text size="sm">{shift.staffName}</Text>
                            )}
                            {shift.why === "" ? null : (
                                <Text size="xs" tone="muted">
                                    {shift.why}
                                </Text>
                            )}
                        </ListItem>
                    ))}
                </SurfaceListCard>
            </div>
        </div>
    </Region>
)

/** Places a picked shift through the same cell action for pointer and keyboard users. */
const gridCellInteraction = (
    props: ShiftsGridBaseProps,
    row: GridRowView,
    columnId: string,
): DataTableCellInteraction | undefined => {
    const cell = row.cells.find((candidate) => candidate.date === columnId)
    if (cell === undefined) return undefined
    return {
        isHighlighted: cell.isTarget,
        tone: cell.isOff ? "muted" : "neutral",
        ...(cell.canDrop ? { onAction: () => props.on.place(row.id) } : {}),
        onDragOver: (event) => {
            if (!cell.canDrop) return
            event.preventDefault()
            props.on.hover(cell.id)
        },
        onDragLeave: () => props.on.hover(null),
        onDrop: (event) => {
            event.preventDefault()
            const shiftId = event.dataTransfer.getData("text/plain")
            if (shiftId !== "") props.on.drop(shiftId, row.id)
        },
    }
}

const renderTableCell = (props: ShiftsGridBaseProps, row: GridRowView, columnId: string) => {
    if (columnId === "staff") {
        return (
            <div className={NAME_CLASS_NAME}>
                <Text size="sm" weight="medium">
                    {row.name}
                </Text>
                <Text size="xs" tone="muted">
                    {row.sub}
                </Text>
            </div>
        )
    }
    const cell = row.cells.find((candidate) => candidate.date === columnId)
    return cell === undefined ? null : renderGridCell({ cell, props })
}

const renderGridCell = ({ cell, props }: RenderGridCellInput) => (
    <div className={CELL_CLASS_NAME}>
        {cell.chips.map((chip) => (
            <DragItem
                key={chip.id}
                isDisabled={!props.props.editable}
                isSelected={chip.isPicked}
                isInvalid={chip.why !== ""}
                isDashed={chip.isOpen}
                {...(chip.color ? { leadingColor: chip.color } : {})}
                onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", chip.id)
                    props.on.dragStart(chip.id)
                }}
                onDragEnd={props.on.dragEnd}
            >
                <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={!props.props.editable}
                    aria-pressed={chip.isPicked}
                    onPress={() => props.on.pick(chip.id)}
                >
                    {chip.time}
                </Button>
                <Text as="span" size="xs" tone="muted" overflow="truncate">
                    {chip.position}
                </Text>
                {chip.why === "" ? null : (
                    <Text size="xs" tone="muted">
                        {chip.why}
                    </Text>
                )}
            </DragItem>
        ))}
        {cell.isOff && cell.chips.length === 0 ? (
            <Text as="span" size="xs" tone="muted">
                {props.props.onLeaveLabel}
            </Text>
        ) : null}
    </div>
)

type RenderGridCellInput = { readonly cell: GridCellView; readonly props: ShiftsGridBaseProps }
/** State values and commands consumed by the connected surface. */
export type ShiftsGridControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly week: ReturnType<typeof useShiftsWeekCommands>
    readonly bench: NonNullable<ReturnType<typeof useShiftsBenchData>>["data"]
    readonly setMoves: React.Dispatch<React.SetStateAction<Readonly<Record<string, string | null>>>>
    readonly picked: string | null
    readonly setPicked: React.Dispatch<React.SetStateAction<string | null>>
    readonly over: string | null
    readonly setOver: React.Dispatch<React.SetStateAction<string | null>>
    readonly dayIndex: number
    readonly setDayIndex: React.Dispatch<React.SetStateAction<number>>
    readonly model: ReturnType<typeof useShiftsWeekModel>
}

/** Narrowed schedule data available after the access guard. */
export type GridCellsInput = ShiftsGridControllerInput & {
    bench: NonNullable<ShiftsGridControllerInput["bench"]>
    model: NonNullable<ShiftsGridControllerInput["model"]>
}
