import { EmptyNotice } from "@starci/grammar/common"
import { AgentSetup } from "@/components/blocks/AgentSetup"
import type { ComponentProps } from "react"

/** The Setup tab, or the notice that only owners and managers set an agent up. */
export interface AgentSetupPageBaseProps {
    readonly props: {
        /** The notice shown instead of the setup; empty when the person may set the agent up. */
        readonly forbidden: string
        readonly setup: ComponentProps<typeof AgentSetup>
    }
}

/** Draws the Setup tab of an agent for an owner or a manager, the notice for anyone else. */
export const AgentSetupPageBase = (props: AgentSetupPageBaseProps) =>
    props.props.forbidden === "" ? (
        <AgentSetup {...props.props.setup} />
    ) : (
        <EmptyNotice message={props.props.forbidden} />
    )
