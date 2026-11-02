import type { ShiftsPersonalViews, ShiftsPersonalActions } from "@/modules/types"
type ShiftsMyShiftsProps = ShiftsPersonalViews["myShifts"] & {
    readonly on: ShiftsPersonalActions["myShifts"] | undefined
    readonly isLoading?: boolean
}
import {
    Cluster,
    Grid,
    Stack,
    type ListRowData,
    Button,
    EmptyNotice,
    Input,
    Select,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"

/** Draws my upcoming shifts with check-in and the inline form that asks a colleague to swap. */
export const ShiftsMyShifts = (props: ShiftsMyShiftsProps) =>
    props.notice === null ? (
        <SurfaceCard
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            kind="list"
            label={props.title}
            headingLevel={2}
            footer={
                <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                    {props.hint}
                </Text>
            }
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

const shiftItem = (props: ShiftsMyShiftsProps, shift: ShiftsPersonalViews["myShiftsMyShiftView"]) =>
    ({
        id: shift.id,
        title: shift.title,
        description: shift.notes.filter((note) => note !== "").join(" · "),
        ...(shift.isCheckedIn ? { badges: [{ label: props.checkedInLabel, tone: "success" }] as const } : {}),
        detail: (
            <Stack gap="row">
                <Cluster gap="row">
                    {shift.canCheckIn && !shift.isCheckedIn ? (
                        <Button
                            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                            size="sm"
                            intent="neutral"
                            isPending={shift.isBusy}
                            onPress={() => props.on?.checkIn(shift.id)}
                        >
                            {props.checkInLabel}
                        </Button>
                    ) : null}
                    <Button
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        size="sm"
                        intent="neutral"
                        onPress={() => props.on?.toggleSwap(shift.id)}
                    >
                        {props.askSwapLabel}
                    </Button>
                </Cluster>
                {props.swap.shiftId === shift.id ? (
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
                            <Button
                                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                intent="neutral"
                                isPending={shift.isBusy}
                                isDisabled={props.swap.toStaffId === ""}
                                onPress={() => props.on?.send(shift.id)}
                            >
                                {props.sendLabel}
                            </Button>
                        </Cluster>
                    </Grid>
                ) : null}
            </Stack>
        ),
    }) satisfies ListRowData
