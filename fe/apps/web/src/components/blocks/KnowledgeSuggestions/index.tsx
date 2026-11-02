"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useKnowledgeIdeas, useLibraryCommands } from "@/hooks/knowledge"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import type { KnowledgeRowView, IdeaDecision } from "@/modules/types"
import { brainTabHref } from "@/modules/routes"
import { toast } from "@/modules/toast"
import { KnowledgeSuggestionsBase } from "./component"

/** One idea the page worked out for the workspace. */
interface SuggestionItem {
    readonly key: string
    readonly state?: IdeaDecision
}

/** How many ideas show before "see more". */
const VISIBLE_IDEAS = 5

/** The longest hint a compact row carries: one line. */
const HINT_MAX = 70

/** The first line of a hint, clipped to what fits one line. */
const oneLineOf = (hint: string): string => {
    const first = hint.split(/(?<=[.!?])\s/u)[0] ?? hint
    return first.length > HINT_MAX ? `${first.slice(0, HINT_MAX - 1).trimEnd()}…` : first
}

type Translate = ReturnType<typeof useTranslations<"knowledge">>

/** One open idea: its topic and a one-line hint, with add, not-applicable and hide as words. */
const openRowOf = (t: Translate, item: SuggestionItem): KnowledgeRowView => ({
    id: item.key,
    title: t(`suggest_${item.key}_topic`),
    lines: [oneLineOf(t(`suggest_${item.key}_hint`))],
    actions: [
        {
            id: "add",
            label: t("suggestAdd"),
            intent: "neutral",
            href: brainTabHref("sources", { add: item.key }),
        },
        {
            id: "na",
            label: t("suggestNotApplicable"),
            intent: "dismiss",
        },
        {
            id: "hide",
            label: t("suggestDismiss"),
            intent: "dismiss",
        },
    ],
})

/** An idea set aside retains its resolved decision and restore command as atom-only row data. */
const skippedRowOf = (t: Translate, item: SuggestionItem, pending: string | undefined): KnowledgeRowView => {
    const decided = item.state === undefined ? undefined : t(item.state === "dismissed" ? "suggestHidden" : "suggestNA")
    return {
        id: item.key,
        title: t(`suggest_${item.key}_topic`),
        badges: decided === undefined ? [] : [{ label: decided, tone: "neutral" }],
        actions: [{ id: "restore", label: t("suggestRestore"), isPending: pending === "restore" }],
    }
}

/** The connected suggestions: opens the add drawer through the address, sets an idea aside or brings it back. */
export const KnowledgeSuggestions = () => {
    const t = useTranslations("knowledge")
    const feedback = useTranslations("toast")
    const commands = useLibraryCommands()
    const ideas = useKnowledgeIdeas()
    const slotLabels = useSlotLabels()
    const [isExpanded, setIsExpanded] = useState(false)
    const failed = () => {
        toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
    }
    const openRow = (item: SuggestionItem): KnowledgeRowView => {
        const row = openRowOf(t, item)
        const pending = commands.pending[`idea:${item.key}`]
        return {
            ...row,
            actions: (row.actions ?? []).map((action) => ({
                ...action,
                isPending: pending === action.id,
                isDisabled: pending !== undefined && pending !== action.id,
                disabledReason: t("actionBusy"),
            })),
        }
    }
    const skippedRow = (item: SuggestionItem): KnowledgeRowView =>
        skippedRowOf(t, item, commands.pending[`idea:${item.key}`])
    if (!ideas.canWrite) return null
    return (
        <KnowledgeSuggestionsBase
            props={{
                list: {
                    section: {
                        id: "knowledge-suggestions-title",
                        title: t("suggestTitle"),
                        failTitle: t("detailFailed"),
                    },
                    label: t("suggestTitle"),
                    footer: t("suggestHint"),
                    isPending: commands.isPending,
                    slot: ideas.isLoading
                        ? loadingSlot<ReadonlyArray<KnowledgeRowView>>()
                        : { items: (isExpanded ? ideas.open : ideas.open.slice(0, VISIBLE_IDEAS)).map(openRow) },
                    slotLabels: slotLabels(t("suggestAllDone")),
                },
                more:
                    ideas.open.length > VISIBLE_IDEAS
                        ? {
                              label: isExpanded
                                  ? t("suggestFewer")
                                  : t("suggestMore", { count: ideas.open.length - VISIBLE_IDEAS }),
                          }
                        : undefined,
                skipped:
                    ideas.skipped.length === 0
                        ? undefined
                        : {
                              label: t("suggestSkipped"),
                              emptyTitle: t("suggestAllDone"),
                              rows: ideas.skipped.map(skippedRow),
                              isPending: commands.isPending,
                          },
            }}
            on={{
                toggleMore: () => setIsExpanded((now) => !now),
                action: (rowId, actionId) => {
                    if (!ideas.canWrite || ![...ideas.open, ...ideas.skipped].some((item) => item.key === rowId)) return
                    if (actionId === "na") commands.decide(rowId, "not_applicable").catch(failed)
                    if (actionId === "hide") commands.decide(rowId, "dismissed").catch(failed)
                    if (actionId === "restore") commands.decide(rowId, null).catch(failed)
                },
            }}
        />
    )
}
