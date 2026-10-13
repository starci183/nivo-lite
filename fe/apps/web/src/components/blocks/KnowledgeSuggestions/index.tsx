"use client"

import { useTranslations } from "next-intl"
import { useLibraryCommands } from "@/hooks/knowledge"
import type { LibraryActions } from "@/hooks/knowledge"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import { writeRetrySource } from "@/modules/db/knowledge/write-retry"
import { writeSuggestionState } from "@/modules/db/knowledge/write-suggestion"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { IdeaDecision } from "@/modules/types"
import { KnowledgeSuggestionsBase } from "./component"

/** One idea the page worked out for the workspace. */
interface SuggestionItem {
    readonly key: string
    readonly state?: IdeaDecision
}

/** Props for the connected suggestions. */
interface KnowledgeSuggestionsProps {
    readonly workspaceId: string
    /** Ideas still open, never required. */
    readonly open: ReadonlyArray<SuggestionItem>
    /** Ideas the owner set aside. */
    readonly skipped: ReadonlyArray<SuggestionItem>
    /** True while the page loads: the heading stays and the list is skeleton rows. */
    readonly isLoading?: boolean
}

const ACTIONS: LibraryActions = { retry: writeRetrySource, decide: writeSuggestionState }

/** The connected suggestions: opens the add drawer through the address, sets an idea aside or brings it back. */
export const KnowledgeSuggestions = (props: KnowledgeSuggestionsProps) => {
    const t = useTranslations("knowledge")
    const commands = useLibraryCommands(props.workspaceId, ACTIONS)
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
                    rows: props.open.map(openRow),
                    isLoading: props.isLoading ?? false,
                    isPending: commands.isPending,
                    emptyTitle: t("suggestAllDone"),
                },
                skipped:
                    props.skipped.length === 0
                        ? undefined
                        : {
                              label: t("suggestSkipped"),
                              rows: props.skipped.map(skippedRow),
                              isLoading: false,
                              isPending: commands.isPending,
                              emptyTitle: t("suggestAllDone"),
                          },
            }}
        />
    )
}
