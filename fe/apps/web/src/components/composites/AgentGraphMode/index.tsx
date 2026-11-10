import { Switch } from "@starci/grammar/common"
import type { AgentGraphModeView } from "@/modules/types"

/** Whether the map decides for the agent, the short name of the switch, and the switch that turns it. */
type AgentGraphModeProps = {
    readonly view: AgentGraphModeView
    /** The short name drawn beside the switch, so it stands compact at the end of a card head. */
    readonly label: string
    /** What the switch means today (the 12px line under its name). */
    readonly description: string
    readonly isLoading: boolean
    readonly onMode: (value: string) => void
}

/** The compact switch that decides whether the agent works by the map or only records it; what each side means stands in the card foot. */
export const AgentGraphMode = (props: AgentGraphModeProps) => (
    <Switch
        label={props.label}
        description={props.description}
        isSelected={props.view.isEnforced}
        isDisabled={props.view.isDisabled}
        isLoading={props.isLoading}
        onSelectedChange={(isEnforced) => props.onMode(isEnforced ? "enforced" : "shadow")}
    />
)
