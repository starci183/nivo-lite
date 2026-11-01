import { Switch } from "@starci/grammar/common"
import type { AgentGraphModeView } from "@/modules/types"

/** Whether the map decides for the agent, and the switch that turns it. */
type AgentGraphModeProps = {
    readonly view: AgentGraphModeView
    readonly isSkeleton: boolean
    readonly onMode: (value: string) => void
}

/** The switch that decides whether the agent works by the map or only records it, with what each side means today. */
export const AgentGraphMode = (props: AgentGraphModeProps) => (
    <Switch
        label={props.view.label}
        description={props.view.hint}
        isSelected={props.view.isEnforced}
        isDisabled={props.view.isDisabled}
        isSkeleton={props.isSkeleton}
        onSelectedChange={(isEnforced) => props.onMode(isEnforced ? "enforced" : "shadow")}
    />
)
