"use client"

import { useTranslations } from "next-intl"
import {
    DOSSIER_STATUS_ORDER,
    queryOfQueue,
    queueAsideOfDossier,
    queueAsideOfFact,
    queueEntryOfFinding,
    queueEntryOfRow,
    reviewBoardOf,
    todoFiltersOf,
    type FindingCardView,
    type QueueWords,
} from "@/modules/brain"
import type { DataSlot, KnowledgeListView, KnowledgeRowView, QueueEntryView } from "@/modules/types"
import { useBrainBoard } from "./useBrainBoard"
import { useBrainGaps } from "./useBrainGaps"
import { useBrainReview } from "./useBrainReview"
import { useDossierFindings } from "./useDossierFindings"
import { useDossierIdentities } from "./useDossierIdentities"
import { useDossierReviewSummary } from "./useDossierReviewSummary"
import { useFindingActions } from "./useFindingActions"
import { useFindingCards } from "./useFindingCards"
import { usePublicProposals } from "./usePublicProposals"

/** The checklist status of a dossier, worded; null for a status the catalog has no word for. */
const statusOf = (brain: ReturnType<typeof useTranslations<"secondBrain">>, status: string): string | null => {
    const known = DOSSIER_STATUS_ORDER.find((one) => one === status)
    return known === undefined ? null : brain(`status_${known}`)
}

/** The rows a region drew, or none while it has none. */
const rowsOf = (list: KnowledgeListView): ReadonlyArray<KnowledgeRowView> =>
    "items" in list.slot ? list.slot.items : []

/** The queue's entries and everything that answers them. */
interface QueueEntries {
    readonly entries: ReadonlyArray<QueueEntryView>
    /** The status of each region the entries come from. */
    readonly regions: ReadonlyArray<DataSlot<unknown>>
    readonly act: (entry: QueueEntryView, actionId: string, partId?: string) => void
    readonly filters: ReturnType<typeof todoFiltersOf>
    readonly paging: { readonly hasNextPage: boolean; readonly loadMore: () => void }
    readonly retry: () => void
    readonly dialog: ReturnType<typeof useFindingActions>["dialog"]
}

/** What the entries of the queue are built from, and what answers them. */
export const useQueueEntries = (): QueueEntries => {
    const q = useTranslations("brainQueue")
    const brain = useTranslations("secondBrain")
    const board = useBrainBoard()
    const review = useBrainReview(board)
    const gaps = useBrainGaps(board)
    const proposals = usePublicProposals()
    const summary = useDossierReviewSummary()
    const list = useDossierFindings(queryOfQueue(), true, summary.revision)
    const { identityOf } = useDossierIdentities()
    const { cardOf } = useFindingCards()
    const findings = ("items" in list.slot ? list.slot.items : undefined) ?? []
    const finding = useFindingActions(findings, list.members)
    const words: QueueWords = {
        choiceTitle: q("choiceTitle"),
        currentLabel: q("currentLabel"),
        inUseTitle: (value) => q("inUseTitle", { value }),
        inUseSource: (source) => q("inUseSource", { source }),
        proposedLabel: q("proposedLabel"),
        factFootnote: q("factFootnote"),
        factKind: q("kindFact"),
        askKind: q("kindAsk"),
        proposalKind: q("kindProposal"),
        dossierStatus: q("dossierStatus"),
        openDossier: q("openDossier"),
        sourceQuotes: q("sourceQuotes"),
    }
    const cards = new Map<string, FindingCardView>()
    const entries: Array<QueueEntryView> = findings.map((one) => {
        const identity = identityOf(one.dossierId ?? undefined)
        const card = cardOf(one, { members: list.members, canWrite: board.canWrite, dossier: identity })
        cards.set(card.id, card)
        const status = identity === undefined ? null : statusOf(brain, identity.status)
        return queueEntryOfFinding(card, one.kind, words, queueAsideOfDossier(card, status, words))
    })
    const regionRows = (region: KnowledgeListView, source: "review" | "gaps" | "proposals") =>
        rowsOf(region).map((row) =>
            queueEntryOfRow(
                row,
                source,
                words,
                source === "review" ? queueAsideOfFact(board.facts, row.id, words) : null,
            ),
        )
    entries.push(
        ...regionRows(review.list, "review"),
        ...regionRows(proposals.list, "proposals"),
        ...regionRows(gaps.list, "gaps"),
    )
    const regions: ReadonlyArray<DataSlot<unknown>> = [list.slot, review.list.slot, proposals.list.slot, gaps.list.slot]
    const act = (entry: QueueEntryView, actionId: string, partId?: string) => {
        if (entry.source === "finding") {
            const action = cards.get(entry.rawId)?.actions.find((one) => one.id === actionId)
            if (action !== undefined) finding.act(entry.rawId, action)
        } else if (entry.source === "review") review.dispatch(entry.rawId, actionId, partId)
        else if (entry.source === "gaps") gaps.dispatch(entry.rawId, actionId)
        else proposals.dispatch(entry.rawId, actionId)
    }
    return {
        entries,
        regions,
        act,
        filters: todoFiltersOf(findings, reviewBoardOf(board.facts).cards, board.gaps.length, proposals.count),
        paging: { hasNextPage: list.hasNextPage, loadMore: list.loadMore },
        retry: () => {
            list.retry()
            review.retry()
            gaps.retry()
            proposals.retry()
        },
        dialog: finding.dialog,
    }
}
