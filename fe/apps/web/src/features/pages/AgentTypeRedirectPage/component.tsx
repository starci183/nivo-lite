import { AgentTypeRedirect } from "@/components/blocks/AgentTypeRedirect"
import type { ModuleKey } from "@/modules/catalog"
import type { AgentTab } from "@/modules/installations"

/** Where an old tab url of a type leads. */
export interface AgentTypeRedirectPageBaseProps {
    readonly props: { readonly module: ModuleKey; readonly tab: AgentTab; readonly query: string }
}

/** Draws the waiting state of an old tab url while the block finds the instance to open. */
export const AgentTypeRedirectPageBase = (props: AgentTypeRedirectPageBaseProps) => (
    <AgentTypeRedirect module={props.props.module} tab={props.props.tab} query={props.props.query} />
)
