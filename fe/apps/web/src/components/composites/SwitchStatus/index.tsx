import { Button, Cluster, Stack, Switch, Text } from "@starci/grammar/common"

/** Props for {@link SwitchStatus}. */
export interface SwitchStatusProps {
    /** Names the switch and is drawn beside it, readable even while the switch cannot be moved. */
    readonly label: string
    readonly isSelected: boolean
    readonly isLoading: boolean
    readonly isDisabled: boolean
    readonly onChange: (on: boolean) => void
    /** The standing guidance under the label. */
    readonly help: string
    /** What stands in the way, in the normal text colour; empty when nothing does. */
    readonly blocker: string
    /** The next step the blocker names, as a button that leads there; null when there is none. */
    readonly blockerAction: { readonly label: string; readonly href: string } | null
    /** A last quiet line, for example who may move the switch; empty when there is none. */
    readonly quiet: string
}

/** One settings band for a switch: the switch, then its name with the guidance under it, and what is left to say. */
export const SwitchStatus = (props: SwitchStatusProps) => (
    <Cluster gap="row" wrap={false} align="start">
        <Switch
            name={props.label}
            label={props.label}
            isLabelHidden
            isSelected={props.isSelected}
            isLoading={props.isLoading}
            isDisabled={props.isDisabled}
            onSelectedChange={props.onChange}
        />
        <Stack gap="identity">
            <Text isStrong>{props.label}</Text>
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.help}
            </Text>
            {props.blocker === "" ? null : <Text size="sm">{props.blocker}</Text>}
            {props.blockerAction === null ? null : (
                <Button intent="commit" size="sm" href={props.blockerAction.href}>
                    {props.blockerAction.label}
                </Button>
            )}
            {props.quiet === "" ? null : (
                <Text size="sm" tone="muted">
                    {props.quiet}
                </Text>
            )}
        </Stack>
    </Cluster>
)
