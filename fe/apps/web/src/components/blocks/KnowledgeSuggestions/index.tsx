"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useKnowledgeIdeas, useLibraryCommands } from "@/hooks/knowledge"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import { brainTabHref } from "@/modules/routes"
import type { IdeaDecision } from "@/modules/types"
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
const openRowOf = (
    t: Translate,
    commands: ReturnType<typeof useLibraryCommands>,
    item: SuggestionItem,
): KnowledgeRowView => ({
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
            onPress: () => commands.decide(item.key, "not_applicable"),
        },
        {
            id: "hide",
            label: t("suggestDismiss"),
            intent: "dismiss",
            onPress: () => commands.decide(item.key, "dismissed"),
        },
    ],
})

/** The connected suggestions: opens the add drawer through the address, sets an idea aside or brings it back. */
export const KnowledgeSuggestions = () => {
    const t = useTranslations("knowledge")
    const commands = useLibraryCommands()
    const ideas = useKnowledgeIdeas()
    const slotLabels = useSlotLabels()
    const [isExpanded, setIsExpanded] = useState(false)
    const decidedLabelOf = (item: SuggestionItem): string | undefined => {
        if (item.state === undefined) return undefined
        return t(item.state === "dismissed" ? "suggestHidden" : "suggestNA")
    }
    const openRow = (item: SuggestionItem): KnowledgeRowView => openRowOf(t, commands, item)
    const skippedRow = (item: SuggestionItem): KnowledgeRowView => {
        const decided = decidedLabelOf(item)
        return {
            id: item.key,
            title: t(`suggest_${item.key}_topic`),
            badges: decided === undefined ? [] : [{ label: decided, tone: "neutral" }],
            actions: [{ id: "restore", label: t("suggestRestore"), onPress: () => commands.decide(item.key, null) }],
        }
    }
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
                              rows: ideas.skipped.map(skippedRow),
                              isPending: commands.isPending,
                          },
            }}
            on={{ toggleMore: () => setIsExpanded((now) => !now) }}
        />
    )
}
