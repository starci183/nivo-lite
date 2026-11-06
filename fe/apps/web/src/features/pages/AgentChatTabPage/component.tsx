"use client"

import { TeamChat } from "@/components/blocks/TeamChat"
import { useInstanceAgentId } from "@/hooks/installations"
import type { ModuleKey } from "@/modules/catalog"

/** The type and the instance whose chat the tab draws. */
export interface AgentChatTabPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
    }
}

/** Draws the chat tab of an agent: the team chat panel on the viewer's direct room with it, flush under the tab line of the instance frame. */
export const AgentChatTabPageBase = (props: AgentChatTabPageBaseProps) => {
    const agentId = useInstanceAgentId(props.props.module, props.props.installationId)
    return agentId === null ? null : <TeamChat kind="agent" agentId={agentId} />
}
