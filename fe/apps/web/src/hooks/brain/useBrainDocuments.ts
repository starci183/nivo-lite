"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useKnowledgeSources, useWorkspaceMember } from "@/hooks/knowledge"
import { slotOfReads } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import {
    factViewsOf,
    factsOfDocument,
    docKindWordOf,
    stepsOf,
    TRUST_LEVEL_KEY,
    type DocumentInput,
} from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type {
    DataSlot,
    BrainDocDrawerView,
    BrainDocsView,
    DocTruthRowView,
    KnowledgeDocument,
    UsageLimitsView,
} from "@/modules/types"
import { useBrain } from "./useBrain"
import { useBrainBulkApply } from "./useBrainBulkApply"
import { useDocumentTruths, type DocumentTruthsView } from "./useDocumentTruths"
import { useKnowledgeRowOf } from "./useKnowledgeRowOf"

/** What the documents tab draws and calls. */
export interface BrainDocumentsView {
    readonly props: Omit<BrainDocsView, "slot" | "placeholder"> & {
        /** The documents as the two reads (the list and the brain) settled. */
        readonly slot: DataSlot<ReadonlyArray<DocTruthRowView>>
        readonly placeholder: ReadonlyArray<DocTruthRowView>
        /** The usage block: its meters as the usage read settled, and the same meters with no figures for its loading state. */
        readonly usage: DataSlot<UsageLimitsView>
        readonly usagePlaceholder: UsageLimitsView
    }
    readonly on: DocumentTruthsView["on"] & {
        readonly open: (id: string) => void
        readonly close: () => void
        readonly askApprove: (id: string) => void
        readonly cancelApprove: () => void
        readonly confirmApprove: () => void
        readonly retry: () => void
        readonly add: () => void
    }
}

/** The same row geometry while the first read has no data: a name, a line and a chip. */
const PLACEHOLDER_ROWS: ReadonlyArray<DocTruthRowView> = [1, 2, 3, 4].map((n): DocTruthRowView => ({
    id: `placeholder-${n}`,
    title: "-",
    meta: "-",
    chips: [{ label: "-", tone: "neutral", isDot: false }],
    control: null,
}))

/** What the approval at the foot of the drawer is made from: the facts waiting, the group the safe ones form and the one being approved. */
interface ApprovalInput {
    readonly proposed: number
    readonly group: { readonly id: string; readonly count: number } | undefined
    readonly pendingId: string | null
}

/** The command that approves the safe facts of the open document, and the words for what it leaves out. */
const approvalOf = (
    t: ReturnType<typeof useTranslations<"brainDocuments">>,
    input: ApprovalInput,
): Pick<BrainDocDrawerView, "approve" | "leftOver"> => {
    const { group } = input
    return {
        approve:
            group === undefined
                ? null
                : { label: t("approve", { count: group.count }), isPending: input.pendingId === group.id },
        leftOver:
            group !== undefined && input.proposed > group.count
                ? t("leftOver", { count: input.proposed - group.count })
                : null,
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
    const truths = useDocumentTruths(sources, useKnowledgeRowOf(sources.live))
    const bulk = useBrainBulkApply()
    const [openId, setOpenId] = useState<string | null>(null)
    const dateOf = (iso: string): string =>
        format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric" })
    const inputOf = (source: KnowledgeDocument): DocumentInput => ({
        source,
        facts: factsOfDocument(brain.brain?.facts ?? [], source.id),
        reading: brain.brain?.extractions.find((extraction) => extraction.sourceId === source.id)?.status,
    })
    const inputs = (sources.sources ?? []).map((source) => inputOf(source))
    const slot = slotOfReads<ReadonlyArray<DocTruthRowView>>(
        [
            { data: sources.sources, error: sources.error, isLoading: sources.isLoading },
            { data: brain.brain, error: brain.error, isLoading: brain.isLoading },
        ],
        () => truths.rows,
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
                  ...approvalOf(t, { proposed: opened.facts.proposed.length, group, pendingId: bulk.pendingId }),
              }
    return {
        props: {
            slot,
            placeholder: PLACEHOLDER_ROWS,
            usage: truths.usage,
            usagePlaceholder: truths.usagePlaceholder,
            drawer,
            confirm: bulk.confirm,
            canAdd: member.canWrite,
        },
        on: {
            ...truths.on,
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
