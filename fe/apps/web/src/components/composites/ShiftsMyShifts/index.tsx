import type { ShiftsPersonalViews, ShiftsPersonalActions } from "@/modules/types"
type ShiftsMyShiftsProps = ShiftsPersonalViews["myShifts"] & {
    readonly on: ShiftsPersonalActions["myShifts"] | undefined
    readonly isLoading?: boolean
}
import { Cluster, Grid, Stack, type ListRowData, EmptyNotice, Input, Select, SurfaceCard } from "@starci/grammar/common"
import { ShiftsListCard } from "@/components/branches/ShiftsListCard"
import { ShiftsActionButton } from "@/components/leaves/ShiftsActionButton"

/** Draws my upcoming shifts with check-in and the inline form that asks a colleague to swap. */
export const ShiftsMyShifts = (props: ShiftsMyShiftsProps) =>
    props.notice === null ? (
        <ShiftsListCard
            title={props.title}
            hint={props.hint}
            isLoading={props.isLoading}
            empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
            items={props.shifts.map((shift) => shiftItem(props, shift))}
        />
    ) : (
        <SurfaceCard
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            ariaLabel={props.notice.title}
        >
            <EmptyNotice message={props.notice.title} description={props.notice.body} />
        </SurfaceCard>
    )

type MyShift = ShiftsPersonalViews["myShiftsMyShiftView"]

/** The inline form that asks a colleague to take the shift. */
const renderSwapForm = (props: ShiftsMyShiftsProps, shift: MyShift) => (
    <Grid kind="form" columns={2}>
        <Select
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.swapWithLabel}
            name={`swap-${shift.id}`}
            value={props.swap.toStaffId === "" ? null : props.swap.toStaffId}
            placeholder={props.pickPersonLabel}
            options={props.swapOptions}
            onValueChange={(value) => props.on?.target(value ?? "")}
        />
        <Input
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            id={`swap-why-${shift.id}`}
            name="reason"
            label={props.reasonLabel}
            value={props.swap.reason}
            {...(props.on === undefined ? {} : { onValueChange: props.on.reason })}
        />
        <Cluster gap="inline" align="end">
            <ShiftsActionButton
                isLoading={props.isLoading}
                intent="neutral"
                isPending={shift.isBusy}
                isDisabled={props.swap.toStaffId === ""}
                onPress={() => props.on?.send(shift.id)}
                label={props.sendLabel}
            />
        </Cluster>
    </Grid>
)

const shiftItem = (props: ShiftsMyShiftsProps, shift: MyShift) =>
    ({
        id: shift.id,
        title: shift.title,
        description: shift.notes.filter((note) => note !== "").join(" · "),
        ...(shift.isCheckedIn ? { badges: [{ label: props.checkedInLabel, tone: "success" }] as const } : {}),
        detail: (
            <Stack gap="row">
                <Cluster gap="row">
                    {shift.canCheckIn && !shift.isCheckedIn ? (
                        <ShiftsActionButton
                            isLoading={props.isLoading}
                            size="sm"
                            intent="neutral"
                            isPending={shift.isBusy}
                            onPress={() => props.on?.checkIn(shift.id)}
                            label={props.checkInLabel}
                        />
                    ) : null}
                    <ShiftsActionButton
                        isLoading={props.isLoading}
                        size="sm"
                        intent="neutral"
                        onPress={() => props.on?.toggleSwap(shift.id)}
                        label={props.askSwapLabel}
                    />
                </Cluster>
                {props.swap.shiftId === shift.id ? renderSwapForm(props, shift) : null}
            </Stack>
        ),
    }) satisfies ListRowData
