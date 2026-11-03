import type { ShiftsWeekViews } from "@/modules/types"
import { EmptyNotice, Select, Stack, SurfaceCard, Tabs, Text } from "@starci/grammar/common"

type GridView = ShiftsWeekViews["grid"]

/** The days to choose from, the shifts of the chosen one and the people a shift can be given to. */
interface ShiftsDayListProps {
    readonly title: string
    readonly days: GridView["dates"]
    readonly selectedDay: string
    readonly emptyDay: string
    readonly shifts: GridView["dayShifts"]
    readonly isEditable: boolean
    readonly assignLabel: string
    readonly assignOptions: GridView["assignOptions"]
    /** The id that stands for "nobody" in the assign select. */
    readonly openId: string
    /** Absent while the commands are not there yet. */
    readonly onDay?: ((date: string) => void) | undefined
    readonly onAssign?: ((shiftId: string, rowId: string) => void) | undefined
    readonly isLoading?: boolean | undefined
}

/** What a row of the day list holds under the shift: the assign select, or the person's name, and why. */
type DetailInput = Pick<
    ShiftsDayListProps,
    "isEditable" | "assignLabel" | "assignOptions" | "openId" | "onAssign" | "isLoading"
>

const renderDetail = (props: DetailInput, shift: GridView["dayShifts"][number]) => (
    <>
        {props.isEditable ? (
            <Select
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                label={props.assignLabel}
                isLabelHidden
                name={`assign-${shift.id}`}
                value={shift.staffId}
                options={props.assignOptions}
                onValueChange={(value) => props.onAssign?.(shift.id, value ?? props.openId)}
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
)

/** The day list that replaces the week grid on phones: the days as tabs, the shifts of the chosen one as rows. */
export const ShiftsDayList = (props: ShiftsDayListProps) => (
    <Stack gap="row">
        <Tabs
            label={props.title}
            selectedKey={props.selectedDay}
            inset="none"
            labelVisibility="always"
            items={props.days}
            {...(props.onDay === undefined ? {} : { onSelect: props.onDay })}
        />
        <SurfaceCard
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            kind="list"
            ariaLabel={props.title}
            empty={<EmptyNotice message={props.emptyDay} />}
            items={props.shifts.map((shift) => ({
                id: shift.id,
                title: `${shift.time} · ${shift.position}`,
                detail: renderDetail(props, shift),
            }))}
        />
    </Stack>
)
