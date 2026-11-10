"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useKnowledgeSources, useWorkspaceMember } from "@/hooks/knowledge"
import { slotOfReads } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import {
    docRowViewOf,
    factViewsOf,
    factsOfDocument,
    docKindWordOf,
    docRowsPlaceholderOf,
    stepsOf,
    TRUST_LEVEL_KEY,
} from "@/modules/brain"
import type { DocumentInput } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainDocDrawerView, BrainDocRowView, BrainDocsView, KnowledgeDocument } from "@/modules/types"
import { useBrain } from "./useBrain"
import { useBrainBulkApply } from "./useBrainBulkApply"

/** What the documents tab draws and calls. */
export interface BrainDocumentsView {
    readonly props: BrainDocsView
    readonly on: {
        readonly open: (id: string) => void
        readonly close: () => void
        readonly askApprove: (id: string) => void
        readonly cancelApprove: () => void
        readonly confirmApprove: () => void
        readonly retry: () => void
        readonly add: () => void
    }
}

/**
 * The documents tab of the Second Brain: every document of the workspace with the facts it gave, and the drawer of the one that is
 * open, which approves its safe facts together through the same path as the review queue (one write, one toast, one undo).
 */
export const useBrainDocuments = (): BrainDocumentsView => {
    const t = useTranslations("brainDocuments")
    const brainWords = useTranslations("brain")
    const format = useFormatter()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const member = useWorkspaceMember()
    const sources = useKnowledgeSources()
    const brain = useBrain()
    const bulk = useBrainBulkApply()
    const [openId, setOpenId] = useState<string | null>(null)
    const dateOf = (iso: string): string =>
        format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric" })
    const inputOf = (source: KnowledgeDocument): DocumentInput => ({
        source,
        facts: factsOfDocument(brain.brain?.facts ?? [], source.id),
        reading: brain.brain?.extractions.find((extraction) => extraction.sourceId === source.id)?.status,
    })
    const inputs = (sources.sources ?? []).map(inputOf)
    const rows: ReadonlyArray<BrainDocRowView> = inputs.map((input) =>
        docRowViewOf(t, input, dateOf(input.source.updatedAt)),
    )
    const slot = slotOfReads<ReadonlyArray<BrainDocRowView>>(
        [
            { data: sources.sources, error: sources.error, isLoading: sources.isLoading },
            { data: brain.brain, error: brain.error, isLoading: brain.isLoading },
        ],
        () => rows,
    )
    const opened = inputs.find((input) => input.source.id === openId)
    const group = bulk.groups.find((one) => one.id === openId)
    const drawer: BrainDocDrawerView | null =
        opened === undefined
            ? null
            : {
                  id: opened.source.id,
                  title: opened.source.title,
                  description: t("drawerMeta", {
                      kind: docKindWordOf(t, opened.source),
                      date: dateOf(opened.source.updatedAt),
                  }),
                  ...stepsOf(t, opened, dateOf(opened.source.createdAt)),
                  factsTitle: t("factsTitle"),
                  factCount: opened.facts.proposed.length + opened.facts.approved.length,
                  facts: factViewsOf(
                      { t, trustLabel: (level) => brainWords(TRUST_LEVEL_KEY[level].label) },
                      opened.source.id,
                      opened.facts,
                  ),
                  approve:
                      group === undefined
                          ? null
                          : { label: t("approve", { count: group.count }), isPending: bulk.pendingId === group.id },
                  leftOver:
                      group !== undefined && opened.facts.proposed.length > group.count
                          ? t("leftOver", { count: opened.facts.proposed.length - group.count })
                          : null,
              }
    return {
        props: {
            slot,
            placeholder: docRowsPlaceholderOf(t),
            drawer,
            confirm: bulk.confirm,
            canAdd: member.canWrite,
        },
        on: {
            open: setOpenId,
            close: () => setOpenId(null),
            askApprove: bulk.on.ask,
            cancelApprove: bulk.on.cancel,
            confirmApprove: bulk.on.confirm,
            retry: () => {
                sources.reload()
                brain.reload()
            },
            add: () => router.push(workspaceHref(workspaceId, brainTabHref("sources", { add: "upload" }))),
        },
    }
}
