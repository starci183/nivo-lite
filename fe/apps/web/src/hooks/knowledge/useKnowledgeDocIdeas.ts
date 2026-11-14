"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { IdeaDecision, DocIdeaView, DocIdeasView } from "@/modules/types"
import { useKnowledgeIdeas } from "./useKnowledgeIdeas"
import { useLibraryCommands } from "./useLibraryCommands"
import { useWorkspaceId } from "@/hooks/workspaces"

/** How many ideas show before "see more". */
const VISIBLE_IDEAS = 5

/** The longest hint a compact row carries: one line. */
const HINT_MAX = 70

/** The first line of a hint, clipped to what fits one line. */
const oneLineOf = (hint: string): string => {
    const first = hint.split(/(?<=[.!?])\s/u)[0] ?? hint
    return first.length > HINT_MAX ? `${first.slice(0, HINT_MAX - 1).trimEnd()}…` : first
}

/** What the suggestions give the side pane. */
interface DocIdeas {
    /** Nothing is drawn for a reader who may not add documents. */
    readonly view: DocIdeasView | null
    /** The suggestions are still being worked out. */
    readonly isLoading: boolean
    readonly decide: (ideaKey: string, menuId: string) => void
    readonly toggleMore: () => void
}

/**
 * The documents worth adding, worded for the suggestions list of the side pane: the most relevant few with a way to see the
 * rest, each with "add" (the drawer opens on its topic) and a menu to say it does not apply or to hide it; the ones set aside
 * with the way to bring them back.
 */
export const useKnowledgeDocIdeas = (onFailed: () => void): DocIdeas => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("knowledge")
    const commands = useLibraryCommands()
    const ideas = useKnowledgeIdeas()
    const [isExpanded, setIsExpanded] = useState(false)
    const pendingOf = (key: string) => commands.pending[`idea:${key}`]
    const openOf = (key: string): DocIdeaView => ({
        id: key,
        title: t(`suggest_${key}_topic`),
        line: oneLineOf(t(`suggest_${key}_hint`)),
        addHref: workspaceHref(workspaceId, brainTabHref("sources", { add: key })),
        isPending: pendingOf(key) !== undefined,
        menu: [
            { id: "na", label: t("suggestNotApplicable") },
            { id: "hide", label: t("suggestDismiss") },
        ],
    })
    const skippedOf = (key: string, state: IdeaDecision | undefined) => ({
        ...openOf(key),
        line: "",
        state: t(state === "dismissed" ? "suggestHidden" : "suggestNA"),
        menu: [{ id: "restore", label: t("suggestRestore") }],
    })
    const shown = isExpanded ? ideas.open : ideas.open.slice(0, VISIBLE_IDEAS)
    const moreKey = isExpanded ? "suggestFewer" : "suggestMore"
    return {
        isLoading: ideas.isLoading,
        view: ideas.canWrite
            ? {
                  title: t("suggestTitle"),
                  hint: t("suggestHint"),
                  addLabel: t("suggestAdd"),
                  menuLabel: t("suggestMenu"),
                  open: shown.map((one) => openOf(one.key)),
                  skipped: ideas.skipped.map((one) => skippedOf(one.key, one.state)),
                  skippedTitle: t("suggestSkipped"),
                  moreLabel:
                      ideas.open.length > VISIBLE_IDEAS
                          ? t(moreKey, { count: ideas.open.length - VISIBLE_IDEAS })
                          : null,
                  emptyLabel: t("suggestAllDone"),
              }
            : null,
        toggleMore: () => setIsExpanded((now) => !now),
        decide: (key, menuId) => {
            if (!ideas.canWrite || ![...ideas.open, ...ideas.skipped].some((one) => one.key === key)) return
            if (menuId === "na") commands.decide(key, "not_applicable").catch(onFailed)
            if (menuId === "hide") commands.decide(key, "dismissed").catch(onFailed)
            if (menuId === "restore") commands.decide(key, null).catch(onFailed)
        },
    }
}
