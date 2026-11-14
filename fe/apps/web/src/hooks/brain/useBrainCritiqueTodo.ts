"use client"

import { useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryBrainCritiqueSourcesSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { knowledgeQuestionsHref, workspaceHref } from "@/modules/routes"
import type { CritiqueTodoView } from "@/modules/types"

/**
 * The documents whose points wait for the owner, one row each, for the to-do tab: the critic's `brainCritiqueSources` read keeps only the
 * documents with an open point, the most pressing first. It is a secondary region: a viewer who may not read it (staff) sees nothing of it.
 */
export const useBrainCritiqueTodo = (): CritiqueTodoView => {
    const t = useTranslations("brainCritique")
    const workspaceId = useWorkspaceId()
    const read = useQueryBrainCritiqueSourcesSwr()
    const slotLabels = useSlotLabels()
    const slot = mapSlot(slotOfSwr(read), (sources) =>
        [...sources]
            .filter((source) => source.open > 0)
            .sort((a, b) => b.high - a.high || b.open - a.open)
            .map((source) => ({
                id: source.sourceId,
                title: source.title,
                line: t("todo.line", { count: source.open }),
                badge: source.high > 0 ? t("todo.high", { count: source.high }) : null,
                href: workspaceHref(workspaceId, knowledgeQuestionsHref(source.sourceId)),
            })),
    )
    return {
        slot,
        placeholder: [
            { id: "placeholder", title: t("todo.label"), line: t("todo.line", { count: 3 }), badge: t("todo.high", { count: 2 }), href: "#" },
        ],
        slotLabels: { ...slotLabels(t("emptyTitle")), error: t("errorTitle") },
        label: t("todo.label"),
        open: t("todo.open"),
        listLabel: t("todo.listLabel"),
    }
}
