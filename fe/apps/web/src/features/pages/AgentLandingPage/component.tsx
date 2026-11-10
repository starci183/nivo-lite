import { AgentLanding } from "@/components/blocks/AgentLanding"
import type { ModuleKey } from "@/modules/catalog"

/** The type and the instance whose landing the page draws. */
export interface AgentLandingPageBaseProps {
    readonly props: { readonly module: ModuleKey; readonly installationId: string }
}

/** Draws the landing block of an agent instance. */
export const AgentLandingPageBase = (props: AgentLandingPageBaseProps) => (
    <AgentLanding module={props.props.module} installationId={props.props.installationId} />
)
