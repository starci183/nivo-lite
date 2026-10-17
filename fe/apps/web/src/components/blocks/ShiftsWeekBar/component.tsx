import type { useTranslations } from "next-intl"
import type { useShiftsFormat, useShiftsBenchData } from "@/hooks/shifts"
import type { useShiftsWeekStore } from "@/hooks/zustand/shiftsWeek"
import type { useShiftsWeekCommands, useShiftsRequestCommands } from "@/hooks/shiftsCommands"
import { Alert, Badge, Button, EmptyNotice, Text } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, BAR_CLASS_NAME, NAV_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** The status badge of the schedule in view. */
export interface WeekBarStatusView {
    readonly tone: "neutral" | "warning" | "success"
    readonly label: string
}

/** Copy and state the connected week bar supplies. */
export interface ShiftsWeekBarBaseProps {
    readonly props: {
        readonly weekLabel: string
        readonly status: WeekBarStatusView
        readonly prevLabel: string
        readonly nextLabel: string
        readonly todayLabel: string
        readonly proposeLabel: string
        readonly publishLabel: string
        /** What the back end is busy with, or an empty line. */
        readonly progress: string
        readonly isDraft: boolean
        readonly canPublish: boolean
        readonly isProposing: boolean
        readonly isPublishing: boolean
        readonly isDeciding: boolean
        /** Nothing is running, so every button can be pressed. */
        readonly isIdle: boolean
        /** Shown under the bar while the week has no schedule. */
        readonly empty: { readonly title: string; readonly body: string } | null
        /** The publish request waiting for the owner, or `null`. */
        readonly waiting: {
            readonly title: string
            readonly description: string
            readonly approveLabel: string
            readonly declineLabel: string
        } | null
    }
    readonly on: {
        readonly previous: () => void
        readonly next: () => void
        readonly today: () => void
        readonly propose: () => void
        readonly publish: () => void
        readonly approve: () => void
        readonly decline: () => void
    }
}

/** Draws week navigation, the schedule status, the propose and publish buttons and the waiting publish decision. */
export const ShiftsWeekBarBase = (props: ShiftsWeekBarBaseProps) => (
    <div className={PANEL_CLASS_NAME}>
        <div className={BAR_CLASS_NAME}>
            <div className={NAV_CLASS_NAME}>
                <Button variant="outline" size="sm" isDisabled={!props.props.isIdle} onPress={props.on.previous}>
                    {props.props.prevLabel}
                </Button>
                <Text size="md" weight="semibold">
                    {props.props.weekLabel}
                </Text>
                <Button variant="outline" size="sm" isDisabled={!props.props.isIdle} onPress={props.on.next}>
                    {props.props.nextLabel}
                </Button>
                <Button variant="ghost" size="sm" isDisabled={!props.props.isIdle} onPress={props.on.today}>
                    {props.props.todayLabel}
                </Button>
                <Badge tone={props.props.status.tone}>{props.props.status.label}</Badge>
            </div>
            <div className={ACTIONS_CLASS_NAME}>
                <Button
                    variant={props.props.isDraft ? "outline" : "primary"}
                    isPending={props.props.isProposing}
                    isDisabled={!props.props.isIdle && !props.props.isProposing}
                    onPress={props.on.propose}
                >
                    {props.props.proposeLabel}
                </Button>
                {props.props.canPublish ? (
                    <Button
                        variant="primary"
                        isPending={props.props.isPublishing}
                        isDisabled={!props.props.isIdle && !props.props.isPublishing}
                        onPress={props.on.publish}
                    >
                        {props.props.publishLabel}
                    </Button>
                ) : null}
            </div>
        </div>
        {props.props.progress === "" ? null : (
            <Text size="sm" tone="muted" live="polite">
                {props.props.progress}
            </Text>
        )}
        {props.props.waiting === null ? null : (
            <div className={PANEL_CLASS_NAME}>
                <Alert
                    tone="informative"
                    title={props.props.waiting.title}
                    description={props.props.waiting.description}
                />
                <div className={NAV_CLASS_NAME}>
                    <Button variant="primary" size="sm" isPending={props.props.isDeciding} onPress={props.on.approve}>
                        {props.props.waiting.approveLabel}
                    </Button>
                    <Button variant="outline" size="sm" isDisabled={props.props.isDeciding} onPress={props.on.decline}>
                        {props.props.waiting.declineLabel}
                    </Button>
                </div>
            </div>
        )}
        {props.props.empty === null ? null : (
            <EmptyNotice message={props.props.empty.title} description={props.props.empty.body} />
        )}
    </div>
)

/** State values and commands consumed by the connected surface. */
export type Busy = "propose" | "explain" | "publish" | "decide" | null

/** State values and commands consumed by the connected surface. */
export type ShiftsWeekBarControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly selected: ReturnType<typeof useShiftsWeekStore.getState>["monday"]
    readonly setSelected: ReturnType<typeof useShiftsWeekStore.getState>["setMonday"]
    readonly bench: NonNullable<ReturnType<typeof useShiftsBenchData>>["data"]
    readonly week: ReturnType<typeof useShiftsWeekCommands>
    readonly requests: ReturnType<typeof useShiftsRequestCommands>
    readonly busy: Busy
    readonly setBusy: React.Dispatch<React.SetStateAction<Busy>>
}

/** Narrowed schedule data available after the access guard. */
export type CreateShiftsWeekBarRowsInput = ShiftsWeekBarControllerInput & {
    bench: NonNullable<ShiftsWeekBarControllerInput["bench"]>
}
