"use client"

import { useTranslations } from "next-intl"
import { useKnowledgeIdeas, useLibraryCommands } from "@/hooks/knowledge"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { IdeaDecision } from "@/modules/types"
import { KnowledgeSuggestionsBase } from "./component"

/** One idea the page worked out for the workspace. */
interface SuggestionItem {
    readonly key: string
    readonly state?: IdeaDecision
}

/** The connected suggestions: opens the add drawer through the address, sets an idea aside or brings it back. */
export const KnowledgeSuggestions = () => {
    const t = useTranslations("knowledge")
    const commands = useLibraryCommands()
    const ideas = useKnowledgeIdeas()
    const decidedLabelOf = (item: SuggestionItem): string | undefined => {
        if (item.state === undefined) return undefined
        return t(item.state === "dismissed" ? "suggestHidden" : "suggestNA")
    }
    const openRow = (item: SuggestionItem): KnowledgeRowView => ({
        id: item.key,
        title: t(`suggest_${item.key}_topic`),
        lines: [t(`suggest_${item.key}_hint`)],
        actions: [
            { id: "add", label: t("suggestAdd"), href: `${KNOWLEDGE_ROUTES.library}?add=${item.key}` },
            { id: "na", label: t("suggestNotApplicable"), onPress: () => commands.decide(item.key, "not_applicable") },
            {
                id: "hide",
                label: t("suggestDismiss"),
                variant: "ghost",
                onPress: () => commands.decide(item.key, "dismissed"),
            },
        ],
    })
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
                        description: t("suggestHint"),
                        failTitle: t("detailFailed"),
                    },
                    label: t("suggestTitle"),
                    rows: ideas.open.map(openRow),
                    isLoading: ideas.isLoading,
                    isPending: commands.isPending,
                    emptyTitle: t("suggestAllDone"),
                },
                skipped:
                    ideas.skipped.length === 0
                        ? undefined
                        : {
                              label: t("suggestSkipped"),
                              rows: ideas.skipped.map(skippedRow),
                              isLoading: false,
                              isPending: commands.isPending,
                              emptyTitle: t("suggestAllDone"),
                          },
            }}
        />
    )
}
