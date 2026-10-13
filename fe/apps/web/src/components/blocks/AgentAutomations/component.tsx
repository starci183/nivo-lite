import { AgentAutomationsFrame } from "@/components/composites/AgentAutomationsFrame"

/** Copy of the automations card of an agent. */
export interface AgentAutomationsBaseProps {
    readonly props: {
        readonly title: string
        readonly seeAllLabel: string
        readonly seeAllHref: string
        readonly help: string
    }
}

/** Draws the card that leads to the automations of the agent. */
export const AgentAutomationsBase = (props: AgentAutomationsBaseProps) => (
    <AgentAutomationsFrame
        title={props.props.title}
        seeAllLabel={props.props.seeAllLabel}
        seeAllHref={props.props.seeAllHref}
        help={props.props.help}
    />
)
