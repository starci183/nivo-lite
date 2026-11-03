"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import {
    findingsOfFilter,
    queryOfQueue,
    reviewBoardOf,
    todoFiltersOf,
    useBrainBoard,
    useDossierFindings,
    useDossierIdentities,
    useDossierReviewSummary,
    useFindingCards,
    useFindingActions,
    useBrainReview,
    useBrainGaps,
    usePublicProposals,
    useFailureToast,
} from "@/hooks/brain"
import type { TodoFilter } from "@/hooks/brain"
import { BrainTodoBase } from "./component"

/** The words of the label of each filter besides the kinds of finding. */
const FILTER_KEY = { all: "filterAll", facts: "filterFacts", ask: "filterAsk" } as const

/** Whether a list of the queue is in view under a filter. */
const isIn = (filter: TodoFilter, own: "facts" | "ask"): boolean => filter === "all" || filter === own

/** Resolves filter names and counts without changing their semantic identifiers. */
const filterViewsOf = (
    options: ReturnType<typeof todoFiltersOf>,
    t: ReturnType<typeof useTranslations<"dossierReview">>,
) =>
    options.map((one) => ({
        id: one.id,
        label: t("filterWithCount", {
            label: t(
                one.id === "all" || one.id === "facts" || one.id === "ask" ? FILTER_KEY[one.id] : `kind_${one.id}`,
            ),
            n: one.count,
        }),
    }))

/**
 * The connected queue of what needs doing: the findings of the dossier review as cards, the facts waiting and the customer
 * questions, in one list with a filter row. Owners and managers answer; everyone reads.
 */
export const BrainTodo = () => {
    const t = useTranslations("dossierReview")
    const failed = useFailureToast()
    const slotLabels = useSlotLabels()
    const board = useBrainBoard()
    const review = useBrainReview(board)
    const gaps = useBrainGaps(board)
    const publicProposals = usePublicProposals()
    const summary = useDossierReviewSummary()
    const list = useDossierFindings(queryOfQueue(), true, summary.revision)
    const { identityOf } = useDossierIdentities()
    const { cardOf } = useFindingCards()
    const [picked, setPicked] = useState<TodoFilter>("all")
    const findings = ("items" in list.slot ? list.slot.items : undefined) ?? []
    const { act, dialog } = useFindingActions(findings, list.members)
    const factCards = reviewBoardOf(board.facts).cards
    const questions = board.gaps.length
    const proposals = publicProposals.count
    const options = todoFiltersOf(findings, factCards, questions, proposals)
    const filter = options.some((one) => one.id === picked) ? picked : "all"
    const shown = findingsOfFilter(findings, filter)
    const isFindingsHidden =
        filter === "facts" ||
        filter === "ask" ||
        (("items" in list.slot ? list.slot.items : undefined) !== undefined &&
            shown.length === 0 &&
            factCards + questions + proposals > 0)
    const labels = slotLabels(t("emptyTodo"))
    return (
        <BrainTodoBase
            props={{
                review: isIn(filter, "facts") ? review.list : null,
                proposals: isIn(filter, "ask") ? publicProposals.list : null,
                gaps: isIn(filter, "ask") ? gaps.list : null,
                filterLabel: t("filterLabel"),
                filters: filterViewsOf(options, t),
                filter,
                cardsLabel: t("todoLabel"),
                cards: isFindingsHidden
                    ? null
                    : mapSlot(list.slot, (all) =>
                          findingsOfFilter(all, filter).map((one) =>
                              cardOf(one, {
                                  members: list.members,
                                  canWrite: board.canWrite,
                                  dossier: identityOf(one.dossierId ?? undefined),
                              }),
                          ),
                      ),
                slotLabels: labels,
                hasNextPage: list.hasNextPage,
                isLoadingMore: list.isLoadingMore,
                loadMoreLabel: t("loadMore"),
                pageFailure: list.hasPageFailure ? labels.error : null,
                dialog: dialog.view,
            }}
            on={{
                setFilter: (value) => setPicked(options.find((one) => one.id === value)?.id ?? filter),
                action: act,
                loadMore: list.loadMore,
                retry: list.retry,
                submitDialog: (values) => {
                    dialog.submit(values).catch(() => {
                        failed()
                    })
                },
                closeDialog: dialog.close,
                reviewAction: review.dispatch,
                gapAction: gaps.dispatch,
                proposalAction: publicProposals.dispatch,
                retryReview: review.retry,
                retryGaps: gaps.retry,
                retryProposals: publicProposals.retry,
            }}
        />
    )
}
