"use client"

import { useState } from "react"
import type { AgentGraphUi } from "@/modules/agent-graph"
import type { AgentGraphBranchForm, AgentGraphPhoneView, AgentGraphSideTab } from "@/modules/types"
import { PHONE_VIEWS, SIDE_TABS } from "./agentGraph.shared"

/** The choices a person makes on the graph panes that are not data: what is selected, which tab shows, what is edited or traced. */
export const useAgentGraphUi = () => {
    const [selectedKey, setSelectedKey] = useState("")
    const [sideTab, setSideTab] = useState<AgentGraphSideTab>("chat")
    const [phoneView, setPhoneView] = useState<AgentGraphPhoneView>("branches")
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [form, setForm] = useState<AgentGraphBranchForm | null>(null)
    const [runId, setRunId] = useState("")
    const ui: AgentGraphUi = { selectedKey, sideTab, phoneView, isDrawerOpen, form, runId, isPublishing: false }
    const select = (key: string) => {
        setSelectedKey(key)
        setForm(null)
        if (key !== "") setSideTab("detail")
    }
    return {
        ui,
        setForm,
        select,
        openNode: (key: string) => {
            select(key)
            setIsDrawerOpen(true)
        },
        closeDrawer: () => setIsDrawerOpen(false),
        sideTab: (value: string) => setSideTab(SIDE_TABS.find((tab) => tab === value) ?? "chat"),
        phoneView: (value: string) => {
            const view = PHONE_VIEWS.find((entry) => entry === value) ?? "branches"
            setPhoneView(view)
            if (view === "chat" || view === "proposals") setSideTab(view)
        },
        trace: (id: string) => {
            setRunId(id)
            setSideTab("detail")
        },
        untrace: () => setRunId(""),
    }
}
