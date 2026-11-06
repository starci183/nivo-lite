"use client"

import { useTranslations } from "next-intl"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { PROPOSAL_PREVIEW_CHARS, clippedText, leftOutLabelsOf, proposalsOf, sourceTitlesOf } from "@/modules/brain"
import type { PublicDocument } from "@/modules/brain"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { KnowledgeListView, KnowledgeRowView } from "@/modules/types"
import { useBrainRowAction } from "./useBrainRowAction"
import { usePublicDocCommands } from "./usePublicDocCommands"
import { usePublicDocuments } from "./usePublicDocuments"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The view `usePublicProposals` returns. */
export interface PublicProposalsView {
    list: KnowledgeListView
    dispatch: (rowId: string, actionId: string) => void
    retry: () => undefined
    count: number
}

/** Owns proposed public answers, retaining their own read status and requiring full revision-bound review before approval. */
export const usePublicProposals = (): PublicProposalsView => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("publicBrain")
    const read = usePublicDocuments()
    const command = usePublicDocCommands()
    const labels = useSlotLabels()
    const { pending, dispatch } = useBrainRowAction({
        actionId: "skip",
        canWrite: read.canWrite,
        isKnown: (rowId) => proposalsOf(read.documents).some((doc) => doc.id === rowId),
        send: (rowId) => command.archive(rowId, t("skipped")),
    })
    const rowOf = (doc: PublicDocument): KnowledgeRowView => {
        const left = leftOutLabelsOf(doc)
        return {
            id: doc.id,
            title: t("proposalTitle", { question: doc.question ?? doc.title }),
            lines: [
                t("proposalSources", { sources: sourceTitlesOf(doc).join(", ") }),
                ...(left.length === 0 ? [] : [t("leftOutLine", { items: left.join(", ") })]),
            ],
            badges: [{ label: t("badge_proposal"), tone: "accent" }],
            parts: [{ id: `${doc.id}-answer`, title: clippedText(doc.body, PROPOSAL_PREVIEW_CHARS) }],
            actions: read.canWrite
                ? [
                      {
                          id: "approve",
                          label: t("approveAndPublish"),
                          intent: "neutral",
                          href: workspaceHref(workspaceId, brainTabHref("publicDocs", { doc: doc.id })),
                      },
                      {
                          id: "edit",
                          label: t("edit"),
                          intent: "neutral",
                          href: workspaceHref(workspaceId, brainTabHref("publicDocs", { doc: doc.id })),
                      },
                      {
                          id: "skip",
                          label: t("skip"),
                          intent: "alternative",
                          isPending: pending === doc.id,
                          isDisabled: pending !== undefined && pending !== doc.id,
                          disabledReason: t("actionBusy"),
                      },
                  ]
                : [],
        }
    }
    const list: KnowledgeListView = {
        section: { id: "public-proposals-title", title: t("proposalsTitle"), failTitle: t("loadFailed") },
        label: t("proposalsTitle"),
        footer: t("proposalsFooter"),
        isPending: command.isPending,
        slot: mapSlot(read.slot, (documents) => proposalsOf(documents).map(rowOf)),
        slotLabels: labels(""),
    }
    return { list, dispatch, retry: read.reload, count: proposalsOf(read.documents).length }
}
