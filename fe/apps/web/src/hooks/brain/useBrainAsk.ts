"use client"

import { useTranslations } from "next-intl"
import { useAskKnowledge } from "@/hooks/knowledge"
import type { AgentLens } from "@/modules/brain"
import { askAgentOptionOf, askGridOf, askPassageOf, askSeesOf } from "@/modules/brain"
import { isWaitingOf, mapSlot, useSlotLabels } from "@/hooks/slot"
import type { BrainAskView, BrainPageHeading } from "@/modules/types"
import { useAgentLenses } from "./useAgentLenses"
import { useBrainPageHeader } from "./useBrainPageHeader"
import { useWorkspaceId } from "@/hooks/workspaces"

/** No agents: one array, so a read that has not answered does not change between renders. */
const NO_AGENTS: ReadonlyArray<AgentLens> = []

/** What the page tells the try-it screen. */
interface BrainAskInput {
    /** The Second Brain heading: trail, title and line. */
    readonly heading: BrainPageHeading
}

/**
 * Everything the try-it screen draws and calls: the agents to ask as, the audience (a customer, or the team where the agent has
 * one), the question and the passages the agent would read for it, and the comparison of what the customer and the agent see.
 * It only reads: nothing here writes a fact or a test case.
 */
export const useBrainAsk = (input: BrainAskInput): BrainAskView => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("knowledge")
    const p = useTranslations("brainAsk")
    const brain = useTranslations("secondBrain")
    const tp = useTranslations("pane")
    const labels = useSlotLabels()
    const header = useBrainPageHeader("agents", input.heading)
    const { lenses, slot, reload } = useAgentLenses()
    const agents = lenses === undefined ? NO_AGENTS : lenses.filter((lens) => lens.kind === "agent")
    const ask = useAskKnowledge(agents)
    const agentsSlot = mapSlot(slot, () => agents.map((lens) => askAgentOptionOf(t, lens)))
    const sees = mapSlot(slot, (all) => askSeesOf(all, ask.agent, brain))
    const audienceOptions = [
        { value: "customer", label: t("askAudiencePublic") },
        ...(ask.canPickAudience ? [{ value: "internal", label: t("askAudienceInternal") }] : []),
    ]
    return {
        props: {
            header: header.props,
            panelId: `${header.props.tabs.panelPrefix}agents`,
            copy: {
                grid: p("gridLabel"),
                back: tp("backToList"),
                headTitle: p("headTitle"),
                headLine: p("headLine"),
                agentLabel: t("askModule"),
                agentPlaceholder: t("selectPlaceholder"),
                audienceLabel: t("askAudience"),
                questionLabel: t("askQuestion"),
                questionPlaceholder: t("askPlaceholder"),
                submitLabel: ask.isPending ? t("asking") : t("askButton"),
                failTitle: t("askFailed"),
                resultsTitle: p("resultsTitle"),
                resultsCount: (count) => p("resultsCount", { count }),
                resultsEmpty: t("askEmpty"),
                seesTitle: brain("viewTitle"),
                seesTable: brain("viewTitle"),
                seesLane: brain("viewLane"),
                seesOpen: brain("viewOpen"),
                seesHint: p("seesHint"),
                closeAside: tp("closeAside"),
            },
            grid: askGridOf(),
            agents: agentsSlot,
            agentsLabels: labels(t("askNoAgents")),
            audienceOptions,
            agentId: ask.agent?.id ?? null,
            audience: ask.audience,
            question: ask.question,
            isPending: ask.isPending,
            results: ask.results === null ? null : ask.results.map((passage) => askPassageOf(t, passage, workspaceId)),
            error: ask.error ?? undefined,
            sees,
            seesLabels: labels(brain("viewEmpty")),
            seesLine: ask.agent === undefined ? "" : p("seesLine", { agent: ask.agent.name ?? "" }),
            isWaiting: isWaitingOf(slot),
        },
        on: {
            reviewAll: header.on.reviewAll,
            selectTab: header.on.selectTab,
            setQuestion: ask.setQuestion,
            setAgent: ask.setAgent,
            setAudience: ask.setAudience,
            ask: ask.ask,
            retry: reload,
        },
    }
}
