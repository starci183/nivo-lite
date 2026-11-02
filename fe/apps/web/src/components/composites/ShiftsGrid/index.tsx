import type { ShiftsWeekViews, ShiftsWeekActions } from "@/modules/types"
type ShiftsGridProps = ShiftsWeekViews["grid"] & {
    readonly on: ShiftsWeekActions["grid"] | undefined
    readonly isLoading?: boolean
}
type GridCellView = ShiftsWeekViews["gridGridCellView"]
type GridRowView = ShiftsWeekViews["gridGridRowView"]
type GridDayShiftView = ShiftsWeekViews["gridGridDayShiftView"]
import {
    Button,
    DataTable,
    type DataTableCellInteraction,
    DragItem,
    EmptyNotice,
    Select,
    SurfaceCard,
    Tabs,
    Text,
    Section,
    Stack,
} from "@starci/grammar/common"
import { DAYLIST_CLASS_NAME, FRAME_CLASS_NAME, NAME_CLASS_NAME, CELL_CLASS_NAME } from "./classNames"

/** One shift of the selected day as a row of the phone's day list. */
const dayShiftItem = (props: ShiftsGridProps, shift: GridDayShiftView) => ({
    id: shift.id,
    title: `${shift.time} · ${shift.position}`,
    detail: (
        <>
            {props.editable ? (
                <Select
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    label={props.assignLabel}
                    isLabelHidden
                    name={`assign-${shift.id}`}
                    value={shift.staffId}
                    options={props.assignOptions}
                    onValueChange={(value) => props.on?.assign(shift.id, value ?? props.openId)}
                />
            ) : (
                <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm">
                    {shift.staffName}
                </Text>
            )}
            {shift.why === "" ? null : (
                <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="xs" tone="muted">
                    {shift.why}
                </Text>
            )}
        </>
    ),
})

/** Draws the people-by-days grid with draggable shift chips, and the day list that replaces it on phones. */
export const ShiftsGrid = (props: ShiftsGridProps) => (
    <Section
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
        title={props.title}
        description={props.hint}
    >
        <div className={FRAME_CLASS_NAME}>
            <DataTable
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                label={props.title}
                columns={[
                    { id: "staff", label: "", isRowHeader: true },
                    ...datesOf(props).map((date) => ({ id: date.id, label: date.label })),
                ]}
                rows={props.rows}
                emptyContent={<EmptyNotice message={props.emptyDay} />}
                renderCell={(row, columnId) => renderTableCell(props, row, columnId)}
                getCellInteraction={(row, columnId) => gridCellInteraction(props, row, columnId)}
            />
        </div>
        <div className={DAYLIST_CLASS_NAME}>
            <Stack gap="row">
                <Tabs
                    label={props.title}
                    selectedKey={props.selectedDay}
                    inset="none"
                    labelVisibility="always"
                    items={datesOf(props)}
                    {...(props.on === undefined ? {} : { onSelect: props.on.day })}
                />
                <SurfaceCard
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    kind="list"
                    ariaLabel={props.title}
                    empty={<EmptyNotice message={props.emptyDay} />}
                    items={props.dayShifts.map((shift) => dayShiftItem(props, shift))}
                />
            </Stack>
        </div>
    </Section>
)

/** Places a picked shift through the same cell action for pointer and keyboard users. */
const gridCellInteraction = (
    props: ShiftsGridProps,
    row: GridRowView,
    columnId: string,
): DataTableCellInteraction | undefined => {
    const cell = row.cells.find((candidate) => candidate.date === columnId)
    if (cell === undefined) return undefined
    return {
        ...(cell.canDrop ? { onAction: () => props.on?.place(row.id) } : {}),
        onDragOver: (event) => {
            if (!cell.canDrop) return
            event.preventDefault()
            props.on?.hover(cell.id)
        },
        onDragLeave: () => props.on?.hover(null),
        onDrop: (event) => {
            event.preventDefault()
            const shiftId = event.dataTransfer.getData("text/plain")
            if (shiftId !== "") props.on?.drop(shiftId, row.id)
        },
    }
}

const renderTableCell = (props: ShiftsGridProps, row: GridRowView, columnId: string) => {
    if (columnId === "staff") {
        return (
            <div className={NAME_CLASS_NAME}>
                <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm">
                    {row.name}
                </Text>
                <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="xs" tone="muted">
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
        <Stack gap="identity">
            {cell.chips.map((chip) => (
                <DragItem
                    key={chip.id}
                    isDisabled={!props.editable}
                    isSelected={chip.isPicked}
                    isInvalid={chip.why !== ""}
                    isDashed={chip.isOpen}
                    onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", chip.id)
                        props.on?.dragStart(chip.id)
                    }}
                    {...(props.on === undefined ? {} : { onDragEnd: props.on.dragEnd })}
                    body={
                        <>
                            <Button
                                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                size="sm"
                                intent="neutral"
                                isDisabled={!props.editable}
                                aria-pressed={chip.isPicked}
                                onPress={() => props.on?.pick(chip.id)}
                            >
                                {chip.time}
                            </Button>
                            <Text
                                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                as="span"
                                size="xs"
                                tone="muted"
                                overflow="truncate"
                            >
                                {chip.position}
                            </Text>
                            {chip.why === "" ? null : (
                                <Text
                                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                    size="xs"
                                    tone="muted"
                                >
                                    {chip.why}
                                </Text>
                            )}
                        </>
                    }
                />
            ))}
            {cell.isOff && cell.chips.length === 0 ? (
                <Text
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    as="span"
                    size="xs"
                    tone="muted"
                >
                    {props.onLeaveLabel}
                </Text>
            ) : null}
        </Stack>
    </div>
)

type RenderGridCellInput = { readonly cell: GridCellView; readonly props: ShiftsGridProps }

const datesOf = (props: ShiftsGridProps) => (props.dates.length === 0 ? props.dayLabels : props.dates)
