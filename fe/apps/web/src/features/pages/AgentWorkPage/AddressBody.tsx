"use client"

import type { ReactElement } from "react"
import { useAgentWorkView } from "@/hooks/agentWork"
import { AgentWorkPageBase } from "./component"

/** The work tab for a boundary that knows no address: the view comes from the browser's address, the panes read the agent from it too. */
export const AgentWorkAddressBody = (): ReactElement => (
    <AgentWorkPageBase props={{ module: undefined, installationId: undefined, view: useAgentWorkView().view }} />
)
