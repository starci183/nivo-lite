import { useTranslations } from "next-intl"
import { BRAIN_PANEL_PREFIX, factRowCountOf } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import {
    BRAIN_STRIP_TABS,
    FIRST_PAGE,
    KNOWLEDGE_CHIPS,
    brainStripTabOf,
    brainTabHref,
    workspaceHref,
    type BrainTab,
    type KnowledgeChip,
} from "@/modules/routes"
import type { BrainChipsView, BrainPageHeading, BrainPageHeaderView, BrainTabItemView } from "@/modules/types"
import { useQueryBrainPoliciesSwr } from "@/hooks/swr"
import { useBrain } from "./useBrain"
import { useBrainTodoCount, useKnowledgeSources } from "@/hooks/knowledge"
import { useBrainPageActions } from "./useBrainPageActions"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The view `useBrainPageHeader` returns. */
export interface BrainPageHeaderViewShape {
    props: BrainPageHeaderView
    on: {
        selectTab: (id: string) => void
        setPart: (id: string) => void
    }
}

/** The panel each page draws its body in: the questions share the public documents' panel, the try the agents'. */
const PANEL_OF: Readonly<Partial<Record<BrainTab, BrainTab>>> = {
    publicAsks: "publicDocs",
    publicTry: "agents",
}

/** How many items each chip of the knowledge tab holds; undefined while its read is still on. */
type ChipCounts = Readonly<Record<KnowledgeChip, number | undefined>>

/** The chip of the knowledge tab a page lights. */
const chipOf = (tab: BrainTab): KnowledgeChip | null => KNOWLEDGE_CHIPS.find((chip) => chip === tab) ?? null

/** How many items each chip holds: the documents, the facts as the facts page lists them and the lessons in use or waiting. */
const useChipCounts = (): ChipCounts => {
    const brain = useBrain().brain
    const sources = useKnowledgeSources().sources
    return {
        sources: sources?.length,
        facts: brain === undefined ? undefined : factRowCountOf(brain.facts),
        lessons: brain?.lessons.filter((one) => one.status === "active" || one.status === "proposed").length,
    }
}

/**
 * The Second Brain's page header with its five tabs (the selected one lives in the address): the to-do inbox carries the one number the
 * rail shows too (a count of zero is none), the policies tab the proposals waiting on the shop rules, the public tab the customer questions nobody answered. Under the knowledge tab the chips
 * link the documents, the facts and the lessons, each with its count.
 */
export const useBrainPageHeader = (selected: BrainTab, heading: BrainPageHeading): BrainPageHeaderViewShape => {
    const t = useTranslations("secondBrain")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const todo = useBrainTodoCount()
    const asks = useBrain().brain?.gapsOpen ?? 0
    /** The proposals waiting on the shop rules; a failed read of the rules simply shows no count. */
    const proposals = useQueryBrainPoliciesSwr().data?.pendingTotal ?? 0
    const counts = useChipCounts()
    const actions = useBrainPageActions(selected)
    const tabs: ReadonlyArray<BrainTabItemView> = [
        { id: "todo", label: t("tab_todo"), ...(todo > 0 ? { count: todo, isAttention: true } : {}) },
        { id: "policies", label: t("tab_policies"), ...(proposals > 0 ? { count: proposals, isAttention: true } : {}) },
        { id: "knowledge", label: t("tab_knowledge") },
        { id: "public", label: t("tab_publicDocs"), ...(asks > 0 ? { count: asks } : {}) },
        { id: "ask", label: t("tab_agents") },
    ]
    const chip = chipOf(selected)
    const chipLabels: Readonly<Record<KnowledgeChip, string>> = {
        sources: t("tab_sources"),
        facts: t("tab_facts"),
        lessons: t("tab_lessons"),
    }
    const chips: BrainChipsView | null =
        chip === null
            ? null
            : {
                  label: t("chipsLabel"),
                  selectedKey: chip,
                  items: KNOWLEDGE_CHIPS.map((one) => {
                      const count = counts[one]
                      return {
                          id: one,
                          label: chipLabels[one],
                          href: workspaceHref(workspaceId, brainTabHref(one)),
                          ...(count === undefined ? {} : { count }),
                      }
                  }),
              }
    const props: BrainPageHeaderView = {
        heading,
        actions: actions.props,
        tabs: {
            label: t("tabsLabel"),
            selectedKey: brainStripTabOf(selected),
            panelPrefix: BRAIN_PANEL_PREFIX,
            panelId: `${BRAIN_PANEL_PREFIX}${PANEL_OF[selected] ?? selected}`,
            items: tabs,
        },
        chips,
    }
    return {
        props,
        on: {
            ...actions.on,
            selectTab: (id: string) => {
                const next = BRAIN_STRIP_TABS.find((tab) => tab === id)
                if (next !== undefined) router.replace(workspaceHref(workspaceId, brainTabHref(FIRST_PAGE[next])))
            },
        },
    }
}
