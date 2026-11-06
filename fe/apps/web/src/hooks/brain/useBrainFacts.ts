"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { usePanePhone } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import {
    brainGridOf,
    entriesSlotOf,
    factEntriesOf,
    factFilterTabsOf,
    factPlaceholderOf,
    factWordsOf,
    headerWithAdd,
    needsMaintenance,
} from "@/modules/brain"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainPageHeaderView, BrainPageHeading, FactDrawerView, FactEntryView, FactsView } from "@/modules/types"
import { useBrainBoard } from "./useBrainBoard"
import { useBrainCommand } from "./useBrainCommand"
import { useBrainPageHeader } from "./useBrainPageHeader"
import { useFactDrawer } from "./useFactDrawer"
import { useFactRetire } from "./useFactRetire"
import { useFailureToast } from "./useFailureToast"
import { usePanePicker } from "./usePanePicker"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the address asks of the facts tab: the heading of the page and the fact drawer it may open. */
interface BrainFactsInput {
    readonly heading: BrainPageHeading
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/** What the facts tab does. */
interface BrainFactsCommands {
    readonly reviewAll: () => void
    readonly selectTab: (id: string) => void
    readonly setFilter: (id: string) => void
    readonly setQuery: (value: string) => void
    readonly select: (id: string) => void
    readonly back: () => void
    readonly retry: () => void
    readonly askRetire: (id: string) => void
    readonly confirmRetire: () => void
    readonly cancelRetire: () => void
    readonly maintain: () => void
}

/** What the facts tab gives its block. */
interface BrainFactsPage {
    readonly header: BrainPageHeaderView
    readonly view: FactsView
    readonly drawer: FactDrawerView | null
    readonly on: BrainFactsCommands
}

/** The facts the search keeps: the title or the line holds the words. */
const matchOf = (entries: ReadonlyArray<FactEntryView>, query: string): ReadonlyArray<FactEntryView> => {
    const needle = query.trim().toLowerCase()
    return entries.filter((entry) => needle === "" || `${entry.title} ${entry.line}`.toLowerCase().includes(needle))
}

/** What the fact entries are made of: the board, the fact a stop is being sent for and the words. */
const factsInputOf = (
    board: ReturnType<typeof useBrainBoard>,
    pending: string | undefined,
    words: ReturnType<typeof factWordsOf>,
    workspaceId: string,
): Parameters<typeof factEntriesOf>[0] => ({
    facts: board.facts,
    lenses: board.lenses,
    canWrite: board.canWrite,
    pending,
    words,
    workspaceId,
})

/**
 * The facts of the Second Brain as the tab of a list beside the opened fact: the facts in force and the scheduled ones, narrowed
 * by type and by a search, with the history of the opened value and the two commands on it (a new value, and stopping its use,
 * which asks first). Each command keeps the permission and the pending identity it had in the old list.
 */
export const useBrainFacts = (input: BrainFactsInput): BrainFactsPage => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("brain")
    const f = useTranslations("brainFacts")
    const board = useBrainBoard()
    const command = useBrainCommand()
    const failed = useFailureToast()
    const slotLabels = useSlotLabels()
    const phone = usePanePhone()
    const header = useBrainPageHeader("facts", input.heading)
    const drawer = useFactDrawer({ tab: "facts", fact: input.fact, edit: input.edit, answer: input.answer })
    const retire = useFactRetire(board.canWrite)
    const [query, setQuery] = useState("")
    const words = factWordsOf(t, f)
    const entries = factEntriesOf(factsInputOf(board, retire.pending, words, workspaceId))
    const isWaiting = "isLoading" in board.slot
    const tabs = isWaiting
        ? [{ id: "all", label: f("filterAll") }]
        : factFilterTabsOf(entries, f("filterAll"), words.typeOf)
    const pick = usePanePicker(tabs, matchOf(entries, query), phone)
    const slot = entriesSlotOf(board.slot, entries, pick.shown)
    const target = entries.find((entry) => entry.id === retire.asking)
    const view: FactsView = {
        slot,
        placeholder: factPlaceholderOf(words),
        slotLabels: { ...slotLabels(f("emptyTitle")), error: f("errorTitle") },
        isFiltered: entries.length > 0 && pick.shown.length === 0,
        filters: tabs,
        filter: pick.filter,
        query,
        selectedId: pick.selected?.id ?? null,
        grid: brainGridOf({ hasAside: false, phone: phone.phone, isWhole: !("items" in slot) && !isWaiting }),
        maintain:
            board.canWrite && needsMaintenance(board.facts, board.nowMs)
                ? {
                      title: t("maintainTitle"),
                      body: t("maintainBody"),
                      actionLabel: t("maintainAction"),
                      isPending: command.isPending,
                  }
                : null,
        retire:
            target === undefined
                ? null
                : {
                      title: f("retireTitle"),
                      description: f("retireBody", { title: target.title }),
                      confirmLabel: f("retireConfirm"),
                      cancelLabel: f("retireCancel"),
                  },
    }
    return {
        header: headerWithAdd(header.props, {
            canWrite: board.canWrite,
            label: t("addFact"),
            href: workspaceHref(workspaceId, brainTabHref("facts", { fact: "new" })),
        }),
        view,
        drawer,
        on: {
            reviewAll: header.on.reviewAll,
            selectTab: header.on.selectTab,
            setFilter: pick.setFilter,
            setQuery,
            select: pick.select,
            back: phone.showList,
            retry: board.reload,
            askRetire: (id) => retire.ask(entries.some((entry) => entry.id === id) ? id : null),
            confirmRetire: () => {
                retire.confirm().catch(failed)
            },
            cancelRetire: () => retire.ask(null),
            maintain: () => {
                command.send("brain.maintain", undefined).catch(failed)
            },
        },
    }
}
