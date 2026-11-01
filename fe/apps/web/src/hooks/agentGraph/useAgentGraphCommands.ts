"use client"

import { useTranslations } from "next-intl"
import { decideFormOf, documentWithDecide, documentWithDecidePoint, formWithChange } from "@/modules/agent-graph"
import type { AgentGraphNodeTexts } from "@/modules/agent-graph"
import type { AgentGraphCommands } from "@/modules/types"
import type { AgentGraphSetup } from "./agentGraph.shared"
import type { AgentGraphRead } from "./useAgentGraphRead"
import type { useAgentGraphUi } from "./useAgentGraphUi"
import type { useAgentGraphWrites } from "./useAgentGraphWrites"

/** What the commands of the graph panes work on: the graph that was read, what the person is doing, and the writes. */
interface CommandsInput {
    readonly read: AgentGraphRead | undefined
    readonly state: ReturnType<typeof useAgentGraphUi>
    readonly writes: ReturnType<typeof useAgentGraphWrites>
    /** Only the owner turns the mode of the graph. */
    readonly canGrant: boolean
    /** The checklist of the setup, applied by the same press that publishes the map. */
    readonly setup: AgentGraphSetup
}

/** The words of the steps an edit may add to the graph. */
const nodeTextsOf = (t: ReturnType<typeof useTranslations<"agentGraph">>): AgentGraphNodeTexts => ({
    decideTitle: t("newDecideTitle"),
    decideDoes: t("newDecideDoes"),
    askTitle: t("newAskTitle"),
    askDoes: t("newAskDoes"),
    stopTitle: t("newStopTitle"),
    stopDoes: t("newStopDoes"),
})

/**
 * The commands of the graph panes: open and change the editor of a decision point, add one, save the draft, publish, confirm or
 * decline a proposal, go back to a version and switch the mode. A command that needs the graph does nothing until it was read.
 */
export const useAgentGraphCommands = (input: CommandsInput): AgentGraphCommands => {
    const t = useTranslations("agentGraph")
    const { read, state, writes } = input
    const facts = read?.data.facts ?? []
    const context = { facts, texts: nodeTextsOf(t) }
    // The count the view shows for the draft, not the edits made on this screen: a draft changed by other means still counts; none, no note.
    const noteOf = (count: number): string => (count > 0 ? t("publishNote", { count }) : "")
    return {
        select: state.select,
        sideTab: state.sideTab,
        phoneView: state.phoneView,
        openNode: state.openNode,
        closeDrawer: state.closeDrawer,
        untrace: state.untrace,
        edit: (nodeKey) => {
            const node = read?.wire.document.nodes.find((entry) => entry.key === nodeKey)
            const form = node === undefined ? null : decideFormOf(node)
            if (form !== null) state.openForm(form)
        },
        change: (change) => state.changeForm((form) => formWithChange(form, change, facts)),
        pickAdder: state.pickAdder,
        addDecide: (action, fact) => {
            const spec = facts.find((entry) => entry.key === fact)
            const next =
                read === undefined || spec === undefined
                    ? null
                    : documentWithDecidePoint(read.wire.document, action, spec, context)
            const node = next?.nodes.find((entry) => entry.decide?.intent === action)
            if (read === undefined || next === null || node === undefined) return
            void writes.saveDocument(read, next, t("savedDraft")).then((isSaved) => {
                const form = decideFormOf(node)
                if (isSaved && form !== null) state.openForm(form)
            })
        },
        save: () => {
            const form = state.ui.form
            if (read === undefined || form === null) return
            const next = documentWithDecide(read.wire.document, form, context)
            void writes.saveDocument(read, next, t("savedDraft")).then((isSaved) => {
                if (isSaved) state.closeForm()
            })
        },
        cancel: state.closeForm,
        publish: () => {
            if (read === undefined) return
            // Applying the checklist publishes the map with it, so one press is one version of both.
            if (input.setup.isReady && input.setup.isChanged) void input.setup.apply().then(writes.refresh)
            else void writes.publish(read.agentId, noteOf(read.data.changes), t("published"))
        },
        decide: (proposalId, isConfirmed) => {
            if (read === undefined) return
            if (isConfirmed) void writes.confirm(read.agentId, proposalId, t("proposalConfirmed"))
            else void writes.decline(read.agentId, proposalId, t("proposalDeclined"))
        },
        mode: (value) => {
            if (read !== undefined && input.canGrant) void writes.mode(read.agentId, value)
        },
        restore: (versionId) => {
            if (read !== undefined) void writes.restore(read.agentId, versionId, t("restored"))
        },
        trace: () => state.trace(read?.data.runs[0]?.id ?? ""),
    }
}
