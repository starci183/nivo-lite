"use client"

import { useTranslations } from "next-intl"
import { useAgentLanding, type ModuleKey } from "@/hooks/installations"
import { AgentLandingBase } from "./component"

/** What the bare url hands the block: the type and the instance of the url. */
interface AgentLandingProps {
    readonly module: ModuleKey
    readonly installationId: string
}

const WAITING_LINES: ReadonlyArray<{ readonly id: string; readonly text: string }> = [
    { id: "first", text: "-" },
    { id: "second", text: "-" },
    { id: "third", text: "-" },
]

/** The landing of an agent instance: leaves for Setup or the workbench once the agent and the member are known. */
export const AgentLanding = (props: AgentLandingProps) => {
    const t = useTranslations("modulesCore")
    useAgentLanding(props.module, props.installationId)
    return <AgentLandingBase props={{ label: t("tabsLabel"), lines: WAITING_LINES }} />
}
