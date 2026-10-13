import {
    Badge,
    Button,
    EmptyNotice,
    Input,
    ListItem,
    SectionHeader,
    Select,
    SurfaceListCard,
} from "@starci/grammar/common"
import { ShiftsLine } from "@/components/composites/ShiftsLine"
import {
    ACTIONS_CLASS_NAME,
    FIELD_ACTION_CLASS_NAME,
    FORM_GRID_CLASS_NAME,
    ROW_CLASS_NAME,
    SECTION_CLASS_NAME,
    SPLIT_CLASS_NAME,
} from "./classNames"

/** The swap form of the one shift being swapped; `shiftId` is `null` when none is open. */
export interface SwapForm {
    readonly shiftId: string | null
    readonly toStaffId: string
    readonly reason: string
}

/** One of my shifts. */
interface MyShiftView {
    readonly id: string
    readonly title: string
    readonly notes: ReadonlyArray<string>
    readonly isCheckedIn: boolean
    /** The shift is today, so checking in is offered. */
    readonly canCheckIn: boolean
    readonly isBusy: boolean
}

/** Copy, shifts and the swap form the connected list supplies. */
export interface ShiftsMyShiftsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly checkInLabel: string
        readonly checkedInLabel: string
        readonly askSwapLabel: string
        readonly swapWithLabel: string
        readonly pickPersonLabel: string
        readonly reasonLabel: string
        readonly sendLabel: string
        readonly shifts: ReadonlyArray<MyShiftView>
        readonly swap: SwapForm
        readonly swapOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    }
    readonly on: {
        readonly checkIn: (id: string) => void
        readonly toggleSwap: (id: string) => void
        readonly target: (id: string) => void
        readonly reason: (text: string) => void
        readonly send: (id: string) => void
    }
}

/** Draws my upcoming shifts with check-in and the inline form that asks a colleague to swap. */
export const ShiftsMyShiftsBase = (props: ShiftsMyShiftsBaseProps) => (
    <div className={SECTION_CLASS_NAME}>
        <SectionHeader level={2} title={props.props.title} description={props.props.hint} />
        <SurfaceListCard
            ariaLabel={props.props.title}
            empty={<EmptyNotice message={props.props.emptyTitle} description={props.props.emptyBody} />}
        >
            {props.props.shifts.map((shift) => (
                <ListItem key={shift.id} className={ROW_CLASS_NAME}>
                    <div className={SPLIT_CLASS_NAME}>
                        <ShiftsLine title={shift.title} notes={shift.notes} />
                        <div className={ACTIONS_CLASS_NAME}>
                            {shift.isCheckedIn ? <Badge tone="success">{props.props.checkedInLabel}</Badge> : null}
                            {shift.canCheckIn && !shift.isCheckedIn ? (
                                <Button
                                    size="sm"
                                    variant="primary"
                                    isPending={shift.isBusy}
                                    onPress={() => props.on.checkIn(shift.id)}
                                >
                                    {props.props.checkInLabel}
                                </Button>
                            ) : null}
                            <Button size="sm" variant="outline" onPress={() => props.on.toggleSwap(shift.id)}>
                                {props.props.askSwapLabel}
                            </Button>
                        </div>
                    </div>
                    {props.props.swap.shiftId === shift.id ? (
                        <div className={FORM_GRID_CLASS_NAME}>
                            <Select
                                label={props.props.swapWithLabel}
                                name={`swap-${shift.id}`}
                                variant="secondary"
                                value={props.props.swap.toStaffId === "" ? null : props.props.swap.toStaffId}
                                placeholder={props.props.pickPersonLabel}
                                options={props.props.swapOptions}
                                onValueChange={(value) => props.on.target(value ?? "")}
                            />
                            <Input
                                id={`swap-why-${shift.id}`}
                                name="reason"
                                label={props.props.reasonLabel}
                                variant="secondary"
                                value={props.props.swap.reason}
                                onValueChange={props.on.reason}
                            />
                            <div className={FIELD_ACTION_CLASS_NAME}>
                                <Button
                                    variant="primary"
                                    isPending={shift.isBusy}
                                    isDisabled={props.props.swap.toStaffId === ""}
                                    onPress={() => props.on.send(shift.id)}
                                >
                                    {props.props.sendLabel}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </ListItem>
            ))}
        </SurfaceListCard>
    </div>
)
