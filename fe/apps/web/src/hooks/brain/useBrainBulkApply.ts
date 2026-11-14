"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useKnowledgeSources, useLibraryCommands } from "@/hooks/knowledge"
import { safeFactCountOf } from "@/modules/brain"
import type { BrainFact, BulkApplyView, BulkGroupView } from "@/modules/types"
import { useBrainBoard } from "./useBrainBoard"
import { useFailureToast } from "./useFailureToast"

/** What the facts filter of the queue draws and calls to apply the facts of one document together. */
interface BrainBulkApply extends BulkApplyView {
    readonly on: {
        readonly ask: (sourceId: string) => void
        readonly cancel: () => void
        readonly confirm: () => void
    }
}

/** The documents that still have facts the apply-together path may take, most facts first. */
const groupsOf = (
    facts: ReadonlyArray<BrainFact>,
    sources: ReadonlyArray<{ id: string; title: string; status: string; visibility: string }>,
    nowMs: number,
): ReadonlyArray<{ id: string; title: string; count: number }> =>
    sources
        .filter((source) => source.status === "ready" && source.visibility === "internal")
        .map((source) => ({ id: source.id, title: source.title, count: safeFactCountOf(facts, source.id, nowMs) }))
        .filter((group) => group.count > 0)
        .sort((left, right) => right.count - left.count)

/**
 * Applies the safe facts of one internal document together through the batch mutation (one write, one undo, one toast from the
 * library commands). It asks first, names the count and the document, and leaves conflicted facts for a person. Nothing shows to a
 * reader who may not write.
 */
export const useBrainBulkApply = (): BrainBulkApply => {
    const t = useTranslations("brainQueue")
    const board = useBrainBoard()
    const sources = useKnowledgeSources()
    const commands = useLibraryCommands()
    const failed = useFailureToast()
    const [asked, setAsked] = useState<string | null>(null)
    const found =
        board.canWrite && sources.sources !== undefined ? groupsOf(board.facts, sources.sources, board.nowMs) : []
    const groups: ReadonlyArray<BulkGroupView> = found.map((group) => ({
        ...group,
        label: t("bulkApply", { count: group.count, title: group.title }),
    }))
    const chosen = groups.find((group) => group.id === asked)
    const pendingId = Object.keys(commands.pending).find((key) => commands.pending[key] === "apply-facts") ?? null
    return {
        groups,
        confirm:
            chosen === undefined
                ? null
                : {
                      title: t("bulkConfirmTitle", { count: chosen.count }),
                      description: t("bulkConfirmBody", { count: chosen.count, title: chosen.title }),
                      confirmLabel: t("bulkConfirm"),
                      cancelLabel: t("bulkCancel"),
                  },
        pendingId,
        on: {
            ask: setAsked,
            cancel: () => {
                setAsked(null)
            },
            confirm: () => {
                if (chosen === undefined) return
                setAsked(null)
                commands.applyFacts(chosen.id).catch(failed)
            },
        },
    }
}
