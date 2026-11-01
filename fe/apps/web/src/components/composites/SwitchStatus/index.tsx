import { Badge, Stack, Text } from "@starci/grammar/common"
import type { ComponentProps } from "react"
import { LabelledSwitch } from "@/components/branches/LabelledSwitch"

/** Props for {@link SwitchStatus}. */
export interface SwitchStatusProps extends ComponentProps<typeof LabelledSwitch> {
    /** The colour of the status badge. */
    readonly tone: NonNullable<ComponentProps<typeof Badge>["tone"]>
    readonly statusLabel: string
    /** The standing guidance under the status. */
    readonly help: string
    /** What stands in the way, in the normal text colour; empty when nothing does. */
    readonly blocker: string
    /** A last quiet line, for example who may move the switch; empty when there is none. */
    readonly quiet: string
}

/** The body of a settings card for one switch: the switch with its label, the status it stands at, the guidance and what is left to say. */
export const SwitchStatus = (props: SwitchStatusProps) => (
    <Stack gap="section">
        <LabelledSwitch
            label={props.label}
            isSelected={props.isSelected}
            isSkeleton={props.isSkeleton}
            isDisabled={props.isDisabled}
            onChange={props.onChange}
        />
        <Badge isDot isSkeleton={props.isSkeleton} tone={props.tone}>
            {props.statusLabel}
        </Badge>
        <Text size="sm" tone="muted">
            {props.help}
        </Text>
        {props.blocker === "" ? null : <Text size="sm">{props.blocker}</Text>}
        {props.quiet === "" ? null : (
            <Text size="sm" tone="muted">
                {props.quiet}
            </Text>
        )}
    </Stack>
)
