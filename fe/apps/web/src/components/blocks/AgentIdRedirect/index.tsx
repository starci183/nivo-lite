"use client"

import { useTranslations } from "next-intl"
import { useAgentIdRedirect } from "@/hooks/installations"
import { AgentIdRedirectBase } from "./component"

/** What the old agent url hands the block. */
interface AgentIdRedirectProps {
    readonly agentId: string
}

/** Sends an old agent setup url to the instance that owns the agent (the installed agents are read in the browser). */
export const AgentIdRedirect = (props: AgentIdRedirectProps) => {
    const t = useTranslations("modulesCore")
    useAgentIdRedirect(props.agentId)
    return <AgentIdRedirectBase props={{ label: t("catalogTitle") }} />
}
