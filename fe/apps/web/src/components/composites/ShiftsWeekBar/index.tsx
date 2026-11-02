import type { ShiftsWeekViews, ShiftsWeekActions } from "@/modules/types"
type ShiftsWeekBarProps = ShiftsWeekViews["weekBar"] & {
    readonly on: ShiftsWeekActions["weekBar"] | undefined
    readonly isLoading?: boolean
}
import { Alert, Badge, Button, EmptyNotice, Text } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, BAR_CLASS_NAME, NAV_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** What the waiting publish decision draws. */
type WaitingDecisionProps = ShiftsWeekBarProps & {
    readonly waiting: NonNullable<ShiftsWeekBarProps["waiting"]>
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
            <Button
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                intent="commit"
                size="sm"
                isPending={props.isDeciding}
                {...(props.on === undefined ? {} : { onPress: props.on.approve })}
            >
                {props.waiting.approveLabel}
            </Button>
            <Button
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                intent="alternative"
                size="sm"
                isDisabled={props.isDeciding}
                {...(props.on === undefined ? {} : { onPress: props.on.decline })}
            >
                {props.waiting.declineLabel}
            </Button>
        </div>
    </div>
)

/** Draws week navigation, the schedule status, the propose and publish buttons and the waiting publish decision. */
export const ShiftsWeekBar = (props: ShiftsWeekBarProps) => (
    <div className={PANEL_CLASS_NAME}>
        <div className={BAR_CLASS_NAME}>
            <div className={NAV_CLASS_NAME}>
                <Button
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    intent="neutral"
                    size="sm"
                    isDisabled={!props.isIdle}
                    {...(props.on === undefined ? {} : { onPress: props.on.previous })}
                >
                    {props.prevLabel}
                </Button>
                <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="md" isStrong>
                    {props.weekLabel}
                </Text>
                <Button
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    intent="neutral"
                    size="sm"
                    isDisabled={!props.isIdle}
                    {...(props.on === undefined ? {} : { onPress: props.on.next })}
                >
                    {props.nextLabel}
                </Button>
                <Button
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    intent="neutral"
                    size="sm"
                    isDisabled={!props.isIdle}
                    {...(props.on === undefined ? {} : { onPress: props.on.today })}
                >
                    {props.todayLabel}
                </Button>
                <Badge
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    tone={props.status.tone}
                >
                    {props.status.label}
                </Badge>
            </div>
            <div className={ACTIONS_CLASS_NAME}>
                <Button
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    intent={props.canPublish ? "alternative" : "commit"}
                    isPending={props.isProposing}
                    isDisabled={!props.isIdle && !props.isProposing}
                    {...(props.on === undefined ? {} : { onPress: props.on.propose })}
                >
                    {props.proposeLabel}
                </Button>
                {props.canPublish ? (
                    <Button
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        intent="commit"
                        isPending={props.isPublishing}
                        isDisabled={!props.isIdle && !props.isPublishing}
                        {...(props.on === undefined ? {} : { onPress: props.on.publish })}
                    >
                        {props.publishLabel}
                    </Button>
                ) : null}
            </div>
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
