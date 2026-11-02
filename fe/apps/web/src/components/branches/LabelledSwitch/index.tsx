import { Cluster, Switch, Text } from "@starci/grammar/common"

/** Props for {@link LabelledSwitch}. */
interface LabelledSwitchProps {
    /** Names the switch and is drawn beside it, readable even while the switch cannot be moved. */
    readonly label: string
    readonly isSelected: boolean
    readonly isLoading: boolean
    readonly isDisabled: boolean
    readonly onChange: (on: boolean) => void
}

/** A switch with its label kept on the line beside it, the way a settings card states one choice. */
export const LabelledSwitch = (props: LabelledSwitchProps) => (
    <Cluster gap="row" wrap={false}>
        <Switch
            name={props.label}
            label={props.label}
            isLabelHidden
            isSelected={props.isSelected}
            isLoading={props.isLoading}
            isDisabled={props.isDisabled}
            onSelectedChange={props.onChange}
        />
        <Text isStrong>{props.label}</Text>
    </Cluster>
)
