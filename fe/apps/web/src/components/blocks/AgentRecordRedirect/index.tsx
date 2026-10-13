"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAgentRecordRoute } from "@/hooks/installations"
import { AgentRecordRedirectBase } from "./component"

/** What the old agent url hands the block. */
interface AgentRecordRedirectProps {
    readonly agentId: string
}

/** Sends an old agent url to the instance its agent drives (agents and installations are read in the browser). */
export const AgentRecordRedirect = (props: AgentRecordRedirectProps) => {
    const t = useTranslations("modulesCore")
    const { isUnknown } = useAgentRecordRoute(props.agentId)
    if (isUnknown) notFound()
    return <AgentRecordRedirectBase props={{ label: t("catalogTitle") }} />
}
