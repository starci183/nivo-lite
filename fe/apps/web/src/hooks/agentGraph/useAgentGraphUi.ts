"use client"

import { useState, useSyncExternalStore } from "react"
import type { AgentGraphUi } from "@/modules/agent-graph"
import type { AgentGraphDecideForm, AgentGraphPhoneView, AgentGraphSideTab } from "@/modules/types"
import { PHONE_VIEWS, SIDE_TABS } from "./agentGraph.shared"

/** From this width the pane beside the graph shows next to it; under it the detail of a node opens in a drawer. */
const SIDE_BY_SIDE_QUERY = "(min-width: 48rem)"

const subscribeSideBySide = (notify: () => void): (() => void) => {
    const query = window.matchMedia(SIDE_BY_SIDE_QUERY)
    query.addEventListener("change", notify)
    return () => query.removeEventListener("change", notify)
}

const readSideBySide = (): boolean => window.matchMedia(SIDE_BY_SIDE_QUERY).matches

const readSideBySideOnServer = (): boolean => true

/** Which tab of the pane beside the graph shows and which view the phone shows. */
interface Tabs {
    readonly sideTab: AgentGraphSideTab
    readonly phoneView: AgentGraphPhoneView
}

/** The decision point being edited and how it started, to tell whether the owner changed anything. */
interface Editing {
    readonly form: AgentGraphDecideForm | null
    readonly start: AgentGraphDecideForm | null
}

/** The choices a person makes on the graph panes that are not data: what is selected, which tab shows, what is edited or traced. */
export const useAgentGraphUi = (initialRunId: string) => {
    const [selectedKey, setSelectedKey] = useState("")
    const [tabs, setTabs] = useState<Tabs>({ sideTab: "chat", phoneView: "branches" })
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [editing, setEditing] = useState<Editing>({ form: null, start: null })
    const [adder, setAdder] = useState({ action: "", fact: "" })
    const [runId, setRunId] = useState(initialRunId)
    const isSideBySide = useSyncExternalStore(subscribeSideBySide, readSideBySide, readSideBySideOnServer)
    const ui: AgentGraphUi = {
        selectedKey,
        sideTab: tabs.sideTab,
        phoneView: tabs.phoneView,
        isDrawerOpen,
        form: editing.form,
        formStart: editing.start,
        adder,
        runId,
        isPublishing: false,
    }
    const showSideTab = (sideTab: AgentGraphSideTab) => setTabs((current) => ({ ...current, sideTab }))
    const select = (key: string) => {
        setSelectedKey(key)
        setEditing({ form: null, start: null })
        if (key !== "") showSideTab("detail")
    }
    return {
        ui,
        /** Changes the form being edited with a function of it; nothing when none is open. */
        changeForm: (change: (form: AgentGraphDecideForm) => AgentGraphDecideForm) =>
            setEditing((current) => ({ ...current, form: current.form === null ? null : change(current.form) })),
        /** Opens the editor on a decision point and remembers how it started. */
        openForm: (value: AgentGraphDecideForm) => {
            setSelectedKey(value.nodeKey)
            setEditing({ form: value, start: value })
            showSideTab("detail")
        },
        closeForm: () => setEditing({ form: null, start: null }),
        pickAdder: (field: "action" | "fact", value: string) => setAdder((pick) => ({ ...pick, [field]: value })),
        select,
        openNode: (key: string) => {
            select(key)
            setIsDrawerOpen(!isSideBySide)
        },
        closeDrawer: () => setIsDrawerOpen(false),
        sideTab: (value: string) => showSideTab(SIDE_TABS.find((tab) => tab === value) ?? "chat"),
        phoneView: (value: string) => {
            const view = PHONE_VIEWS.find((entry) => entry === value) ?? "branches"
            const isSide = view === "chat" || view === "proposals" || view === "versions"
            setTabs((current) => ({ phoneView: view, sideTab: isSide ? view : current.sideTab }))
        },
        trace: (id: string) => {
            setRunId(id)
            showSideTab("detail")
        },
        untrace: () => setRunId(""),
    }
}
