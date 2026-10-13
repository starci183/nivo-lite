import { AgentRecordRedirect } from "@/components/blocks/AgentRecordRedirect"

/** The agent an old url named. */
export interface AgentRecordRedirectPageBaseProps {
    readonly props: { readonly agentId: string }
}

/** Draws the waiting state of an old agent url while the block finds the instance to open. */
export const AgentRecordRedirectPageBase = (props: AgentRecordRedirectPageBaseProps) => (
    <AgentRecordRedirect agentId={props.props.agentId} />
)
