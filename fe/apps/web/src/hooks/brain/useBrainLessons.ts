"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { usePanePhone } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import {
    brainGridOf,
    entriesSlotOf,
    headerWithAdd,
    lessonEntriesOf,
    lessonFilterTabsOf,
    lessonPlaceholderOf,
    lessonWordsOf,
    type MineOutcome,
} from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import { toast } from "@/modules/toast"
import type { BrainLens, BrainPageHeaderView, BrainPageHeading, LessonDrawerView, LessonsView } from "@/modules/types"
import { useBrainBoard } from "./useBrainBoard"
import { useBrainPageHeader } from "./useBrainPageHeader"
import { useFailureToast } from "./useFailureToast"
import { useLessonDesk } from "./useLessonDesk"
import { useLessonDrawer } from "./useLessonDrawer"
import { usePanePicker } from "./usePanePicker"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the address asks of the lessons tab: the heading of the page and whether the lesson drawer is open. */
interface BrainLessonsInput {
    readonly heading: BrainPageHeading
    readonly lesson: string | undefined
}

/** What the lessons tab does. */
interface BrainLessonsCommands {
    readonly selectTab: (id: string) => void
    readonly setFilter: (id: string) => void
    readonly setAgent: (value: string | null) => void
    readonly mine: () => void
    readonly select: (id: string) => void
    readonly back: () => void
    readonly retry: () => void
    readonly add: () => void
    readonly act: (entryId: string, actionId: string) => void
}

/** What the lessons tab gives its block. */
interface BrainLessonsPage {
    readonly header: BrainPageHeaderView
    readonly view: LessonsView
    readonly drawer: LessonDrawerView | null
    readonly on: BrainLessonsCommands
}

/** The backend state each decision on a lesson asks for. */
const STATE_OF = { apply: "active", skip: "rejected", retire: "retired" } as const

/** The state a decision asks for; undefined for a word that is no decision. */
const stateOf = (actionId: string) =>
    actionId === "apply" || actionId === "skip" || actionId === "retire" ? STATE_OF[actionId] : undefined

/** What the control that picks the agent is made of. */
interface AgentViewInput {
    readonly agent: string
    readonly desk: ReturnType<typeof useLessonDesk>
    readonly canWrite: boolean
}

/** The control that picks the agent the list is about, and the command that studies its corrections. */
const agentViewOf = (
    l: ReturnType<typeof useTranslations<"brainLessons">>,
    options: LessonsView["agent"]["options"],
    input: AgentViewInput,
): LessonsView["agent"] => ({
    label: l("agentLabel"),
    options,
    value: input.agent,
    mineLabel: l("mine"),
    isMining: input.desk.isMining,
    canMine: input.canWrite,
})

/** The agent value that stands for every agent. */
const ALL_AGENTS = "all"

type Brain = ReturnType<typeof useTranslations<"brain">>

/** What studying the corrections found, in one line. */
const noticeOf = (t: Brain, mined: MineOutcome): string => {
    if (mined.reason === "not_enough") return t("mineNotEnough", { n: mined.corrections })
    if (mined.reason === "model_unavailable") return t("mineUnavailable")
    return t("mineDone", { n: mined.proposed, c: mined.corrections, k: mined.newCases })
}

/** The agents a lesson may be about: every agent first, then each one of the shop. */
const agentOptionsOf = (lenses: ReadonlyArray<BrainLens>, all: string) => [
    { id: ALL_AGENTS, label: all },
    ...lenses.map((lens) => ({ id: lens.module, label: lens.name })),
]

/**
 * The lessons of the Second Brain as the tab of a list beside the opened lesson: how each agent should work, learnt from the
 * owner's corrections. The list narrows by agent and status; the study of the corrections and the lesson written by hand (in a
 * drawer) are the owner's, and a proposed lesson is applied or skipped, a lesson in force is stopped.
 */
export const useBrainLessons = (input: BrainLessonsInput): BrainLessonsPage => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("brain")
    const l = useTranslations("brainLessons")
    const board = useBrainBoard()
    const desk = useLessonDesk()
    const failed = useFailureToast()
    const slotLabels = useSlotLabels()
    const phone = usePanePhone()
    const router = navigation.useRouter()
    const header = useBrainPageHeader("lessons", input.heading)
    const [agent, setAgent] = useState(ALL_AGENTS)
    const [pending, setPending] = useState<string | undefined>()
    const words = lessonWordsOf(l)
    const lessons = board.lessons.filter((one) => agent === ALL_AGENTS || one.module === null || one.module === agent)
    const entries = lessonEntriesOf({ lessons, lenses: board.lenses, canWrite: board.canWrite, pending, words })
    const isWaiting = "isLoading" in board.slot
    const tabs = isWaiting
        ? [{ id: "all", label: l("filterAll") }]
        : lessonFilterTabsOf(entries, l("filterAll"), words.statusOf)
    const pick = usePanePicker(tabs, entries, phone)
    const slot = entriesSlotOf(board.slot, entries, pick.shown)
    const options = agentOptionsOf(board.lenses, l("allAgents"))
    const drawer = useLessonDrawer({
        isRequested: input.lesson === "new",
        canWrite: board.canWrite,
        agentOptions: options,
        agentLabel: l("agentLabel"),
        agentPlaceholder: l("agentPlaceholder"),
        desk,
    })
    const decide = async (entryId: string, actionId: string) => {
        const state = stateOf(actionId)
        if (!board.canWrite || state === undefined || !board.lessons.some((one) => one.id === entryId)) return
        setPending(`${entryId}:${actionId}`)
        try {
            await desk.decide(entryId, state)
        } finally {
            setPending(undefined)
        }
    }
    const view: LessonsView = {
        slot,
        placeholder: lessonPlaceholderOf(words),
        slotLabels: { ...slotLabels(l("emptyTitle")), error: l("errorTitle") },
        isFiltered: entries.length > 0 && pick.shown.length === 0,
        filters: tabs,
        filter: pick.filter,
        selectedId: pick.selected?.id ?? null,
        grid: brainGridOf({ hasAside: false, phone: phone.phone, isWhole: !("items" in slot) && !isWaiting }),
        agent: agentViewOf(l, options, { agent, desk, canWrite: board.canWrite }),
        notice: desk.mined === null ? null : noticeOf(t, desk.mined),
    }
    const addHref = workspaceHref(workspaceId, brainTabHref("lessons", { lesson: "new" }))
    return {
        header: headerWithAdd(header.props, { canWrite: board.canWrite, label: l("addLesson"), href: addHref }),
        view,
        drawer,
        on: {
            selectTab: header.on.selectTab,
            setFilter: pick.setFilter,
            setAgent: (value) => setAgent(value ?? agent),
            mine: () => {
                if (!board.canWrite || desk.isPending) return
                if (agent === ALL_AGENTS) toast.info(l("mineNeedsAgent"))
                else desk.mine(agent).catch(failed)
            },
            select: pick.select,
            back: phone.showList,
            retry: board.reload,
            add: () => router.push(addHref),
            act: (entryId, actionId) => {
                decide(entryId, actionId).catch(failed)
            },
        },
    }
}
