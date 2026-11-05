import { Button, Icon } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** The command that opens an add form in place. */
interface AgentWorkAddButtonProps {
    readonly label: string
    readonly onPress: () => void
}

/** The "Add" command at the end of a list heading of the Work tab. */
export const AgentWorkAddButton = (props: AgentWorkAddButtonProps) => (
    <Button
        intent="neutral"
        size="sm"
        startContent={<Icon source={nivoIconSource("add", "leading")} usage="leading" />}
        onPress={props.onPress}
    >
        {props.label}
    </Button>
)
