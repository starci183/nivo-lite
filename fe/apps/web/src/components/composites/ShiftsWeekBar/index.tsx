import type { ShiftsWeekViews, ShiftsWeekActions } from "@/modules/types"
type ShiftsWeekBarProps = ShiftsWeekViews["weekBar"] & {
    readonly on: ShiftsWeekActions["weekBar"] | undefined
    readonly isLoading?: boolean
}
import { Alert, Badge, EmptyNotice, Text } from "@starci/grammar/common"
import { ShiftsActionButton, type ShiftsActionButtonProps } from "@/components/leaves/ShiftsActionButton"
import { ACTIONS_CLASS_NAME, BAR_CLASS_NAME, NAV_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** What the waiting publish decision draws. */
type WaitingDecisionProps = ShiftsWeekBarProps & {
    readonly waiting: NonNullable<ShiftsWeekBarProps["waiting"]>
}

/** The approve and decline buttons of the waiting publish decision. */
const decisionButtonsOf = (props: WaitingDecisionProps): ReadonlyArray<ShiftsActionButtonProps> => {
    const decisions: ReadonlyArray<ShiftsActionButtonProps> = [
        {
            label: props.waiting.approveLabel,
            intent: "commit",
            isPending: props.isDeciding,
            onPress: props.on?.approve,
        },
        {
            label: props.waiting.declineLabel,
            intent: "alternative",
            isDisabled: props.isDeciding,
            onPress: props.on?.decline,
        },
    ]
    return decisions.map((button): ShiftsActionButtonProps => ({ ...button, size: "sm", isLoading: props.isLoading }))
}

/** The publish decision that waits for an owner: approve it or decline it. */
const WaitingDecision = (props: WaitingDecisionProps) => (
    <div className={PANEL_CLASS_NAME}>
        <Alert
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            tone="informative"
            title={props.waiting.title}
            description={props.waiting.description}
        />
        <div className={NAV_CLASS_NAME}>
            {decisionButtonsOf(props).map((button) => (
                <ShiftsActionButton key={button.label} {...button} />
            ))}
        </div>
    </div>
)

/** The previous, next and today buttons: they wait while the schedule is busy. */
const navButtonsOf = (props: ShiftsWeekBarProps) => {
    const common = { intent: "neutral", size: "sm", isDisabled: !props.isIdle, isLoading: props.isLoading } as const
    return {
        previous: { ...common, label: props.prevLabel, onPress: props.on?.previous },
        next: { ...common, label: props.nextLabel, onPress: props.on?.next },
        today: { ...common, label: props.todayLabel, onPress: props.on?.today },
    }
}

/** Week navigation: previous, the week, next, today and the status of its schedule. */
const WeekNavigation = (props: ShiftsWeekBarProps) => {
    const nav = navButtonsOf(props)
    return (
        <div className={NAV_CLASS_NAME}>
            <ShiftsActionButton {...nav.previous} />
            <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="md" isStrong>
                {props.weekLabel}
            </Text>
            <ShiftsActionButton {...nav.next} />
            <ShiftsActionButton {...nav.today} />
            <Badge {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} tone={props.status.tone}>
                {props.status.label}
            </Badge>
        </div>
    )
}

/** The propose button and, once a schedule can be published, the publish button. */
const ScheduleActions = (props: ShiftsWeekBarProps) => (
    <div className={ACTIONS_CLASS_NAME}>
        <ShiftsActionButton
            isLoading={props.isLoading}
            intent={props.canPublish ? "alternative" : "commit"}
            isPending={props.isProposing}
            isDisabled={!props.isIdle && !props.isProposing}
            onPress={props.on?.propose}
            label={props.proposeLabel}
        />
        {props.canPublish ? (
            <ShiftsActionButton
                isLoading={props.isLoading}
                intent="commit"
                isPending={props.isPublishing}
                isDisabled={!props.isIdle && !props.isPublishing}
                onPress={props.on?.publish}
                label={props.publishLabel}
            />
        ) : null}
    </div>
)

/** Draws week navigation, the schedule status, the propose and publish buttons and the waiting publish decision. */
export const ShiftsWeekBar = (props: ShiftsWeekBarProps) => (
    <div className={PANEL_CLASS_NAME}>
        <div className={BAR_CLASS_NAME}>
            <WeekNavigation {...props} />
            <ScheduleActions {...props} />
        </div>
        {props.progress === "" ? null : (
            <Text
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                size="sm"
                tone="muted"
                live="polite"
            >
                {props.progress}
            </Text>
        )}
        {props.waiting === null ? null : <WaitingDecision {...props} waiting={props.waiting} />}
        {props.empty === null ? null : <EmptyNotice message={props.empty.title} description={props.empty.body} />}
    </div>
)
